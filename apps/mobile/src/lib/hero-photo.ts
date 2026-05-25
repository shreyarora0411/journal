import { getGooglePlacesKey } from '@/lib/google-places';
import { log } from '@/lib/log';
import { getSupabase } from '@/lib/supabase';

/**
 * Hero photo resolver. Picks one image for a place using this priority
 * chain (Session 1 revised brief):
 *
 *   1. User-uploaded photo (handled elsewhere — trip_photos + cover_photo_id)
 *   2. Curated library — `curated_destinations` table
 *   3. Unsplash search — broad aesthetic fallback
 *   4. Google Places photo — utility coverage fallback
 *   5. No photo — caller renders a clean photo-less card
 *
 * Once resolved, the URL + source + credit are cached back to the
 * place's `hero_photo_*` columns so future loads skip the network.
 */

export type HeroPhotoSource = 'user' | 'curated' | 'unsplash' | 'google_places';

export type HeroPhoto = {
  url: string;
  source: HeroPhotoSource;
  credit: string | null;
} | null;

export type PlaceRowForHero = {
  id: string;
  name: string;
  country: string | null;
  google_place_id: string | null;
  hero_photo_url: string | null;
  hero_photo_source: HeroPhotoSource | null;
  hero_photo_credit: string | null;
};

// — Unsplash --------------------------------------------------------------

type UnsplashHit = {
  urls: { regular: string };
  user: { name: string; links?: { html?: string } };
  likes?: number;
  description?: string | null;
  alt_description?: string | null;
};

/**
 * Heuristic: is this Unsplash result good enough?
 *
 * Conservative on purpose — we'd rather fall through to Google Places
 * than render a mediocre Unsplash photo. Reject:
 *   - < 5 likes (unloved photos are usually weak)
 *   - description / alt-text doesn't mention any query word (avoids
 *     generic skylines when searching for a specific place)
 *
 * Tune after seeing real results. If too many fall through, lower the
 * like threshold or remove the description match. If too many bad
 * results land, raise the threshold.
 */
const unsplashResultIsGoodEnough = (result: UnsplashHit | undefined, query: string): boolean => {
  if (!result) return false;
  if ((result.likes ?? 0) < 5) return false;
  const text = `${result.description ?? ''} ${result.alt_description ?? ''}`.toLowerCase();
  const queryWords = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2);
  if (queryWords.length > 0 && !queryWords.some((w) => text.includes(w))) return false;
  return true;
};

const tryUnsplash = async (
  name: string,
  country: string | null,
): Promise<{ url: string; credit: string } | null> => {
  const key = process.env.EXPO_PUBLIC_UNSPLASH_ACCESS_KEY;
  if (!key) return null;
  try {
    const query = [name, country].filter(Boolean).join(' ');
    const res = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=3&orientation=landscape&content_filter=high&order_by=relevant`,
      { headers: { Authorization: `Client-ID ${key}` } },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { results?: UnsplashHit[] };
    const picked = (json.results ?? []).find((r) => unsplashResultIsGoodEnough(r, query));
    if (!picked) return null;
    return {
      url: picked.urls.regular,
      credit: `Photo by ${picked.user.name} on Unsplash`,
    };
  } catch (err) {
    log.warn('hero-photo: unsplash fetch failed', { error: String(err) });
    return null;
  }
};

// — Google Places photo --------------------------------------------------

const tryGooglePlacesPhoto = async (
  googlePlaceId: string,
): Promise<{ url: string; credit: string } | null> => {
  const key = getGooglePlacesKey();
  if (!key) return null;
  try {
    const detailRes = await fetch(
      `https://places.googleapis.com/v1/places/${encodeURIComponent(googlePlaceId)}`,
      {
        headers: {
          'X-Goog-Api-Key': key,
          'X-Goog-FieldMask': 'photos',
        },
      },
    );
    if (!detailRes.ok) return null;
    const detail = (await detailRes.json()) as {
      photos?: Array<{
        name?: string;
        authorAttributions?: Array<{ displayName?: string }>;
      }>;
    };
    const first = detail.photos?.[0];
    if (!first?.name) return null;
    const url =
      `https://places.googleapis.com/v1/${first.name}/media` +
      `?maxWidthPx=1600&key=${encodeURIComponent(key)}`;
    const attribution = first.authorAttributions?.[0]?.displayName;
    const credit = attribution ? `Photo via Google · ${attribution}` : 'Photo via Google';
    return { url, credit };
  } catch (err) {
    log.warn('hero-photo: google places fetch failed', { error: String(err) });
    return null;
  }
};

// — Resolver --------------------------------------------------------------

/**
 * Resolve a hero photo for a place. Tries curated → Unsplash → Google
 * Places in order; caches the resolved URL back to the place row.
 *
 * Returns `null` to mean "render a clean photo-less card". The caller
 * should never render a fallback image — that's where the Eiffel Tower
 * lived.
 */
export const resolveHeroPhoto = async (place: PlaceRowForHero): Promise<HeroPhoto> => {
  // Cached.
  if (place.hero_photo_url) {
    return {
      url: place.hero_photo_url,
      source: place.hero_photo_source ?? 'unsplash',
      credit: place.hero_photo_credit,
    };
  }

  const supabase = getSupabase();
  const cachePlace = async (next: {
    url: string;
    source: HeroPhotoSource;
    credit: string | null;
  }) => {
    const { error } = await supabase
      .from('places')
      .update({
        hero_photo_url: next.url,
        hero_photo_source: next.source,
        hero_photo_credit: next.credit,
      })
      .eq('id', place.id);
    if (error) log.warn('hero-photo cache write failed', { error: error.message });
  };

  // 2a. Curated by Place ID
  if (place.google_place_id) {
    const { data, error } = await supabase
      .from('curated_destinations')
      .select('photo_url, photo_credit')
      .eq('google_place_id', place.google_place_id)
      .maybeSingle();
    if (!error && data) {
      const next = { url: data.photo_url, source: 'curated' as const, credit: data.photo_credit };
      await cachePlace(next);
      return next;
    }
  }

  // 2b. Curated by name + country
  if (place.name) {
    let q = supabase
      .from('curated_destinations')
      .select('photo_url, photo_credit')
      .ilike('normalized_name', place.name.toLowerCase());
    if (place.country) q = q.eq('country', place.country);
    const { data: byName, error: nameErr } = await q.maybeSingle();
    if (!nameErr && byName) {
      const next = {
        url: byName.photo_url,
        source: 'curated' as const,
        credit: byName.photo_credit,
      };
      await cachePlace(next);
      return next;
    }
  }

  // 3. Unsplash
  const unsplash = await tryUnsplash(place.name, place.country);
  if (unsplash) {
    const next = { url: unsplash.url, source: 'unsplash' as const, credit: unsplash.credit };
    await cachePlace(next);
    return next;
  }

  // 4. Google Places
  if (place.google_place_id) {
    const places = await tryGooglePlacesPhoto(place.google_place_id);
    if (places) {
      const next = { url: places.url, source: 'google_places' as const, credit: places.credit };
      await cachePlace(next);
      return next;
    }
  }

  // 5. No photo.
  return null;
};
