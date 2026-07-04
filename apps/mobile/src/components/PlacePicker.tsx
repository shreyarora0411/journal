import {
  type PlaceAutocompleteHit,
  type PlaceDetails,
  type PlacePickerMode,
  newSessionToken,
  placeAutocomplete,
  placeDetails,
} from '@/lib/google-places';
import { getSupabase } from '@/lib/supabase';
import { hubLabel } from '@journal/shared';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

/** A founder-seeded canonical_places row surfaced as a picker hit. */
type CanonicalRow = {
  google_place_id: string;
  name: string;
  hub: string | null;
  zone: string | null;
  destination_text: string | null;
  lat: number | null;
  lng: number | null;
};

/** Search the seeded corpus by name — Google misses small/new venues and
 *  dies with quota/offline; the ~300 hand-fingerprinted places must stay
 *  findable regardless. Fail-soft: an error just means no extra hits. */
const searchCanonical = async (q: string): Promise<CanonicalRow[]> => {
  try {
    const { data } = await getSupabase()
      .from('canonical_places')
      .select('google_place_id, name, hub, zone, destination_text, lat, lng')
      .ilike('name', `%${q}%`)
      .limit(4);
    return (data ?? []) as CanonicalRow[];
  } catch {
    return [];
  }
};

const CORAL = '#FF4D2E';
const INK = '#1A1410';
const MUTE = '#7A716A';
const HAIR = '#EFEAE2';
const TINT = '#FAF6F0';

const DEBOUNCE_MS = 250;

type Props = {
  /** "city" narrows to localities; "broad" allows POIs and establishments. */
  mode?: PlacePickerMode;
  placeholder?: string;
  /** Pre-filled text on first render. */
  initialQuery?: string;
  /**
   * Called when the user picks an autocomplete result. `details` will be
   * a fully-resolved `PlaceDetails` (Place ID, country, lat/lng, types).
   */
  onPick: (details: PlaceDetails) => void;
  /**
   * Called when the user opts to submit free text instead of picking a
   * result. `name` is whatever they typed. The caller should persist a
   * place row with no `google_place_id`.
   */
  onFreeText?: (name: string) => void;
  testID?: string;
};

/**
 * Google Places autocomplete dropdown.
 *
 * Behavior:
 *   - Type → 250ms debounce → POST /places:autocomplete
 *   - Up to 5 results render below the input.
 *   - Tap a result → fetch details → call onPick(details).
 *   - The "Use 'X' anyway" row at the bottom lets the user submit free
 *     text when nothing matches. Calls onFreeText(name).
 *   - All API calls share one session token per picker mount for billing
 *     optimization; a new mount = new token.
 */
export function PlacePicker({
  mode = 'broad',
  placeholder = 'Search a place',
  initialQuery = '',
  onPick,
  onFreeText,
  testID,
}: Props) {
  const [query, setQuery] = useState(initialQuery);
  const [hits, setHits] = useState<PlaceAutocompleteHit[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resolving, setResolving] = useState<string | null>(null);
  const sessionToken = useMemo(() => newSessionToken(), []);
  const abortRef = useRef<AbortController | null>(null);
  // Canonical rows keyed by google_place_id — tapping one resolves locally
  // (no Google details call: we already hold coords, and it dodges quota).
  const canonicalRef = useRef<Map<string, CanonicalRow>>(new Map());

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setHits([]);
      setSearched(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const [google, canonical] = await Promise.all([
        placeAutocomplete(trimmed, { mode, sessionToken, signal: controller.signal }),
        mode === 'broad' ? searchCanonical(trimmed) : Promise.resolve([]),
      ]);
      if (!controller.signal.aborted) {
        canonicalRef.current = new Map(canonical.map((c) => [c.google_place_id, c]));
        const googleIds = new Set(google.map((h) => h.placeId));
        const extra: PlaceAutocompleteHit[] = canonical
          .filter((c) => !googleIds.has(c.google_place_id))
          .map((c) => ({
            placeId: c.google_place_id,
            primary: c.name,
            secondary: [hubLabel(c.hub), c.zone].filter(Boolean).join(' · ') || 'On the map',
            description: c.name,
          }));
        setHits([...google, ...extra]);
        setSearched(true);
        setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query, mode, sessionToken]);

  const onTapHit = async (hit: PlaceAutocompleteHit) => {
    const canonical = canonicalRef.current.get(hit.placeId);
    if (canonical) {
      onPick({
        google_place_id: canonical.google_place_id,
        name: canonical.name,
        country: null,
        country_iso: null,
        region: null,
        locality: canonical.destination_text,
        lat: canonical.lat,
        lng: canonical.lng,
        types: [],
      });
      return;
    }
    setResolving(hit.placeId);
    const details = await placeDetails(hit.placeId, { sessionToken });
    setResolving(null);
    if (details) onPick(details);
  };

  const trimmed = query.trim();
  const showFreeText = trimmed.length >= 2 && onFreeText;

  return (
    <View testID={testID}>
      <View style={styles.inputCard}>
        <TextInput
          accessibilityLabel="Search place"
          placeholder={placeholder}
          placeholderTextColor="#B7AEA5"
          value={query}
          onChangeText={setQuery}
          style={styles.input}
          selectionColor={CORAL}
          autoCorrect={false}
          autoCapitalize="words"
        />
        {loading ? <ActivityIndicator size="small" color={MUTE} /> : null}
      </View>

      {!loading && searched && hits.length === 0 ? (
        <View style={styles.noResults}>
          <Text style={styles.noResultsText}>
            Nothing found — check the spelling, or you may be offline.
          </Text>
        </View>
      ) : null}

      {hits.length > 0 ? (
        <View style={styles.dropdown}>
          {hits.map((h) => (
            <Pressable
              key={h.placeId}
              accessibilityRole="button"
              accessibilityLabel={h.description}
              onPress={() => onTapHit(h)}
              disabled={resolving !== null}
              style={({ pressed }) => [styles.hitRow, pressed && styles.hitRowPressed]}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.hitPrimary}>{h.primary}</Text>
                {h.secondary ? <Text style={styles.hitSecondary}>{h.secondary}</Text> : null}
              </View>
              {resolving === h.placeId ? (
                <ActivityIndicator size="small" color={MUTE} />
              ) : (
                <Text style={styles.chevron}>›</Text>
              )}
            </Pressable>
          ))}
        </View>
      ) : null}

      {showFreeText ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Use "${trimmed}" anyway`}
          onPress={() => onFreeText?.(trimmed)}
          style={styles.freeTextRow}
        >
          <Text style={styles.freeTextLabel}>
            Use <Text style={{ color: INK }}>"{trimmed}"</Text> anyway
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  inputCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: HAIR,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  input: {
    flex: 1,
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    color: INK,
    paddingVertical: 2,
  },
  dropdown: {
    marginTop: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: HAIR,
    borderRadius: 14,
    overflow: 'hidden',
  },
  hitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: HAIR,
  },
  hitRowPressed: { backgroundColor: TINT },
  hitPrimary: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 15,
    color: INK,
  },
  hitSecondary: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    color: MUTE,
    marginTop: 2,
  },
  chevron: {
    fontFamily: 'PlayfairDisplay_500Medium',
    fontSize: 22,
    color: MUTE,
  },
  freeTextRow: {
    paddingHorizontal: 4,
    paddingVertical: 10,
    marginTop: 6,
  },
  freeTextLabel: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    color: MUTE,
  },
  noResults: {
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: HAIR,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
  },
  noResultsText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    color: MUTE,
  },
});
