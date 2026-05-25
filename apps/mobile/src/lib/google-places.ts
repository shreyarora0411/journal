import { log } from '@/lib/log';
import { Platform } from 'react-native';

/**
 * Google Places API (v1) — autocomplete + place details.
 *
 * Three keys are configured per the original Session 1 setup:
 *   - EXPO_PUBLIC_GOOGLE_PLACES_KEY_DEV   (dev / web)
 *   - EXPO_PUBLIC_GOOGLE_PLACES_KEY_IOS   (iOS production)
 *   - EXPO_PUBLIC_GOOGLE_PLACES_KEY_ANDROID (Android production)
 *
 * Network errors return null / [] — never throw. The picker UI gracefully
 * falls back to free-text input when the API is unreachable.
 */

const BASE = 'https://places.googleapis.com/v1';

export type PlaceAutocompleteHit = {
  /** Google Place ID — stable identifier. */
  placeId: string;
  /** Primary text ("Mumbai") + secondary text ("Maharashtra, India"). */
  primary: string;
  secondary: string;
  /** Full formatted description for display. */
  description: string;
};

export type PlaceDetails = {
  google_place_id: string;
  name: string;
  country: string | null;
  region: string | null;
  lat: number | null;
  lng: number | null;
  types: string[];
};

export const getGooglePlacesKey = (): string | null => {
  if (__DEV__) return process.env.EXPO_PUBLIC_GOOGLE_PLACES_KEY_DEV ?? null;
  if (Platform.OS === 'ios') return process.env.EXPO_PUBLIC_GOOGLE_PLACES_KEY_IOS ?? null;
  if (Platform.OS === 'android') return process.env.EXPO_PUBLIC_GOOGLE_PLACES_KEY_ANDROID ?? null;
  return process.env.EXPO_PUBLIC_GOOGLE_PLACES_KEY_DEV ?? null;
};

/**
 * Optional locality-only filter. Pass `mode: 'city'` to limit results to
 * cities + regions (used by the home-city picker on Framing). Default
 * mode is broad — covers cities, neighborhoods, points-of-interest, and
 * establishments (used by the Log screen's place picker).
 */
export type PlacePickerMode = 'city' | 'broad';

const includedPrimaryTypes = (mode: PlacePickerMode): string[] => {
  if (mode === 'city') {
    return ['locality', 'administrative_area_level_1', 'administrative_area_level_2'];
  }
  return [];
};

/**
 * Live autocomplete. Returns up to 5 hits. The Places API v1 supports a
 * `sessionToken` for billing optimization — callers pass the same token
 * across all keystrokes in one user session and a different token for
 * each subsequent picker open.
 */
export const placeAutocomplete = async (
  input: string,
  opts: { mode?: PlacePickerMode; sessionToken?: string; signal?: AbortSignal } = {},
): Promise<PlaceAutocompleteHit[]> => {
  const key = getGooglePlacesKey();
  if (!key) return [];
  const trimmed = input.trim();
  if (trimmed.length < 2) return [];

  const mode = opts.mode ?? 'broad';
  const body: Record<string, unknown> = {
    input: trimmed,
    languageCode: 'en',
  };
  if (opts.sessionToken) body.sessionToken = opts.sessionToken;
  const primaries = includedPrimaryTypes(mode);
  if (primaries.length > 0) body.includedPrimaryTypes = primaries;

  try {
    const res = await fetch(`${BASE}/places:autocomplete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
      },
      body: JSON.stringify(body),
      signal: opts.signal,
    });
    if (!res.ok) {
      // Surface the real error body so misconfigurations (referrer
      // restrictions, missing API enable, billing not set up) don't
      // present as a silent empty dropdown.
      let detail = '';
      try {
        const errBody = (await res.json()) as { error?: { status?: string; message?: string } };
        detail = `${errBody.error?.status ?? ''} ${errBody.error?.message ?? ''}`.trim();
      } catch {
        // ignore — fall back to status code only
      }
      log.warn('google-places autocomplete non-200', { status: res.status, detail });
      return [];
    }
    const json = (await res.json()) as {
      suggestions?: Array<{
        placePrediction?: {
          placeId: string;
          structuredFormat?: {
            mainText?: { text?: string };
            secondaryText?: { text?: string };
          };
          text?: { text?: string };
        };
      }>;
    };
    const hits: PlaceAutocompleteHit[] = [];
    for (const s of json.suggestions ?? []) {
      const p = s.placePrediction;
      if (!p?.placeId) continue;
      const primary = p.structuredFormat?.mainText?.text ?? p.text?.text ?? '';
      const secondary = p.structuredFormat?.secondaryText?.text ?? '';
      hits.push({
        placeId: p.placeId,
        primary,
        secondary,
        description: [primary, secondary].filter(Boolean).join(', '),
      });
    }
    return hits.slice(0, 5);
  } catch (err) {
    // AbortError is normal during fast typing — don't log it.
    const name =
      err && typeof err === 'object' && 'name' in err ? (err as { name?: string }).name : '';
    if (name !== 'AbortError') {
      log.warn('google-places autocomplete failed', { error: String(err) });
    }
    return [];
  }
};

/**
 * Place details fetch. Returns the shape the Log screen needs:
 * name + country + region + lat/lng + types.
 *
 * Field mask is required by Places API v1; we ask only for what we use.
 */
export const placeDetails = async (
  placeId: string,
  opts: { sessionToken?: string } = {},
): Promise<PlaceDetails | null> => {
  const key = getGooglePlacesKey();
  if (!key) return null;

  const url = new URL(`${BASE}/places/${encodeURIComponent(placeId)}`);
  if (opts.sessionToken) url.searchParams.set('sessionToken', opts.sessionToken);

  try {
    const res = await fetch(url.toString(), {
      headers: {
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': 'id,displayName,formattedAddress,location,types,addressComponents',
      },
    });
    if (!res.ok) {
      let detail = '';
      try {
        const errBody = (await res.json()) as { error?: { status?: string; message?: string } };
        detail = `${errBody.error?.status ?? ''} ${errBody.error?.message ?? ''}`.trim();
      } catch {
        // ignore
      }
      log.warn('google-places details non-200', { status: res.status, detail });
      return null;
    }
    const json = (await res.json()) as {
      id?: string;
      displayName?: { text?: string };
      location?: { latitude?: number; longitude?: number };
      types?: string[];
      addressComponents?: Array<{ longText?: string; shortText?: string; types?: string[] }>;
    };
    if (!json.id) return null;

    const components = json.addressComponents ?? [];
    const country = components.find((c) => c.types?.includes('country'))?.longText ?? null;
    const region =
      components.find((c) => c.types?.includes('administrative_area_level_1'))?.longText ?? null;

    return {
      google_place_id: json.id,
      name: json.displayName?.text ?? '',
      country,
      region,
      lat: json.location?.latitude ?? null,
      lng: json.location?.longitude ?? null,
      types: json.types ?? [],
    };
  } catch (err) {
    log.warn('google-places details failed', { error: String(err) });
    return null;
  }
};

/**
 * Returns a fresh session token (UUID v4). Use one per picker-open session
 * for billing optimization — Google groups autocomplete + details calls
 * sharing a token into a single billable session.
 */
export const newSessionToken = (): string => {
  // Lightweight UUID v4 — avoid pulling a uuid package just for this.
  const r = () =>
    Math.floor(Math.random() * 0x10000)
      .toString(16)
      .padStart(4, '0');
  return `${r()}${r()}-${r()}-${r()}-${r()}-${r()}${r()}${r()}`;
};
