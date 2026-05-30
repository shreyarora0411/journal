import { log } from '@/lib/log';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

const INK = '#1A1410';
const TINT = '#FAF6F0';
const HAIR = '#EFEAE2';
const MUTE = '#7A716A';
const PAPER = '#FFFFFF';

type Props = {
  cityName: string;
  countryName: string | null;
  /** Right-aligned meta (e.g. "3 tips"). Optional. */
  meta?: string;
  height?: number;
};

type UnsplashHit = {
  urls: { regular: string; small: string };
  user: { name: string };
};

/**
 * Fetch one Unsplash photo per city name. Cached by TanStack Query so a
 * scroll back to the same city doesn't refetch. Returns null when the
 * Unsplash key isn't set or no result — the caller renders the
 * typography-only header in that case.
 */
const fetchCityPhoto = async (
  cityName: string,
  countryName: string | null,
): Promise<{ url: string; credit: string } | null> => {
  const key = process.env.EXPO_PUBLIC_UNSPLASH_ACCESS_KEY;
  if (!key) return null;
  try {
    const query = [cityName, countryName].filter(Boolean).join(' ');
    const res = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=3&orientation=landscape`,
      { headers: { Authorization: `Client-ID ${key}` } },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { results?: UnsplashHit[] };
    const first = json.results?.[0];
    if (!first) return null;
    return {
      url: first.urls.regular,
      credit: `Photo: ${first.user.name} / Unsplash`,
    };
  } catch (err) {
    log.warn('city-hero unsplash fetch failed', { error: String(err) });
    return null;
  }
};

/**
 * Editorial-style city banner. 140pt by default, full-width. Image
 * fills the rectangle with a dark gradient overlay at the bottom so
 * the city name (italic serif, white) reads cleanly regardless of
 * photo content.
 *
 * Falls back to a tinted-paper card with the same typography when the
 * photo isn't available — never a "missing image" frame.
 */
export function CityHero({ cityName, countryName, meta, height = 140 }: Props) {
  const q = useQuery({
    queryKey: ['city-hero', cityName, countryName],
    queryFn: () => fetchCityPhoto(cityName, countryName),
    staleTime: 60 * 60 * 1000, // 1h
  });

  const photo = q.data ?? null;

  return (
    <View style={[styles.wrap, { height }]}>
      {photo ? (
        <Image
          source={{ uri: photo.url }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={200}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.fallback]} />
      )}
      {/* Bottom gradient so text reads regardless of photo */}
      <View style={styles.bottomFade} />
      <View style={styles.label}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[styles.name, !photo && { color: INK }]}>{cityName}</Text>
          {countryName ? (
            <Text style={[styles.country, !photo && { color: MUTE }]}>{countryName}</Text>
          ) : null}
        </View>
        {meta ? <Text style={[styles.meta, !photo && { color: MUTE }]}>{meta}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: TINT,
    borderWidth: 1,
    borderColor: HAIR,
  },
  fallback: {
    backgroundColor: TINT,
  },
  bottomFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '55%',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  label: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  name: {
    fontFamily: 'InstrumentSerif_400Italic',
    fontSize: 30,
    lineHeight: 34,
    color: PAPER,
    letterSpacing: -0.6,
  },
  country: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 10,
    letterSpacing: 1.4,
    color: PAPER,
    opacity: 0.85,
  },
  meta: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 10,
    letterSpacing: 1.2,
    color: PAPER,
    opacity: 0.85,
  },
});
