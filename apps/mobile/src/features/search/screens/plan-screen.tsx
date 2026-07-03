import { Eyebrow, Face, Page, StatusSpace } from '@/components';
import { useToast } from '@/hooks/use-toast';
import { log } from '@/lib/log';
import type { VouchType } from '@journal/shared';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRecordDestinationSearch } from '../api/use-destination-signals';
import { useRecordInteraction } from '../api/use-record-interaction';
import { useSaveVouch, useSavedVouchIds } from '../api/use-save-vouch';
import { useDebounced } from '../api/use-search';
import {
  type VouchSearchResult,
  useVouchSearch,
  vouchReason,
  vouchTier,
} from '../api/use-vouch-search';

const CORAL = '#FF4D2E';
const INK = '#1A1410';
const MUTE = '#7A716A';
const FAINT = '#B7AE9F';
const HAIR = '#EFEAE2';
const TINT = '#FAF6F0';

const TYPE_PILL: Record<VouchType, { label: string; fg: string; bg: string }> = {
  stay: { label: 'Stay', fg: '#4E6B45', bg: '#E6EEDF' },
  eat_drink: { label: 'Eat / Drink', fg: '#B23A14', bg: '#FBE6DC' },
  do: { label: 'Do', fg: '#1F5F5C', bg: '#D6E9E7' },
  nightlife: { label: 'Nightlife', fg: '#4A1F40', bg: '#EFD8E8' },
  good_to_know: { label: 'Good to know', fg: '#2F5E6E', bg: '#DEEBEF' },
  skip: { label: 'Skip', fg: '#7A3A20', bg: '#F2E2D2' },
};

// Vouch types that map to a physical place worth opening in Maps. A
// good_to_know / skip note has no single pin, so it gets Share only.
const PLACE_TYPES = new Set<VouchType>(['stay', 'eat_drink', 'do', 'nightlife']);

type ListGroup = {
  key: string;
  listId: string | null;
  who: string;
  avatar: string | null;
  listTitle: string | null;
  // Relationship tier for this author's vouches. 'fof' => a friend of a
  // friend (weak-tie discovery supply); null => your own / a direct friend.
  tier: 'fof' | null;
  rows: VouchSearchResult[];
};

/**
 * Plan / Search (Loop B home) — the discovery surface.
 *
 * Destination in → trusted friends' vouches out, ranked by WHO said it and
 * grouped by the trip they came from. Person and original wording lead; no
 * generic place list, no stars, no taste-fit score (v3 §4C).
 */
export function PlanScreen() {
  const router = useRouter();
  const toast = useToast();
  const [destination, setDestination] = useState('');
  const q = useVouchSearch(destination);
  const savedIds = useSavedVouchIds();
  const saveVouch = useSaveVouch();
  const recordInteraction = useRecordInteraction();

  // Capture the searched destination as a viewer-PRIVATE consideration signal
  // (migration 54). Debounced + deduped per place so we log "you were looking
  // at {dest}", not a row per keystroke. Powers honest first-person resurfacing
  // on the home — never broadcast to the circle, never a fabricated travel date.
  const recordDestSearch = useRecordDestinationSearch();
  const debouncedDest = useDebounced(destination.trim());
  const lastLoggedDest = useRef<string | null>(null);
  useEffect(() => {
    const key = debouncedDest.toLowerCase();
    if (debouncedDest.length >= 2 && lastLoggedDest.current !== key) {
      lastLoggedDest.current = key;
      recordDestSearch.mutate(debouncedDest);
    }
  }, [debouncedDest, recordDestSearch]);

  useEffect(() => {
    log.event('plan.screen_entered');
  }, []);

  // Outbound "act on it" — open the spot in Maps, or hand the voiced line to
  // the OS share sheet (WhatsApp, copy, Messages…). Closes the gap where a
  // trusted answer was delivered but the user had to leave to use it.
  const openMaps = (r: VouchSearchResult) => {
    // Acting on someone's rec is a revealed-preference signal — record it so we
    // can learn "you trust them for {category}". Fire-and-forget; the RPC no-ops
    // on your own vouches, so no need to pre-filter here.
    recordInteraction.mutate({ vouchId: r.vouch_id, kind: 'maps' });
    // Lead phrase before the first dash/comma is usually the venue name
    // ("Lub'd Samui — private 2-bed" -> "Lub'd Samui"); pair it with the city.
    const lead = r.vouch_text.split(/[—–\-,.]/)[0]?.trim() || r.vouch_text;
    // When background resolution has linked a canonical place, deep-link to the
    // exact venue via query_place_id so the pin is precise — not the fuzzy
    // text search. Falls back to the lead-phrase heuristic when unresolved.
    const url = r.place_google_id
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          r.place_name || `${lead}, ${r.destination_text}`,
        )}&query_place_id=${r.place_google_id}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          `${lead}, ${r.destination_text}`,
        )}`;
    Linking.openURL(url).catch((err) => {
      log.error('open maps failed', err);
      toast.show({ message: 'Could not open Maps.', variant: 'error' });
    });
  };
  const shareVouch = (r: VouchSearchResult) => {
    recordInteraction.mutate({ vouchId: r.vouch_id, kind: 'share' });
    const who = r.is_own ? 'I' : (r.author_name ?? r.author_handle ?? 'A friend');
    Share.share({
      message: `"${r.vouch_text}" — ${who} vouched · ${r.destination_text}`,
    }).catch((err) => log.error('share vouch failed', err));
  };

  const results = q.data ?? [];
  const trimmed = destination.trim();
  const showHint = trimmed.length < 2;
  const showNoResults = !showHint && !q.isLoading && results.length === 0;

  // Group ranked vouches by source list, preserving rank order: a list's
  // position is set by its best-ranked vouch. Vouches with no list fall
  // under a per-author bucket keyed by author.
  const groups = useMemo<ListGroup[]>(() => {
    const map = new Map<string, ListGroup>();
    for (const r of results) {
      const key = r.list_id ?? `author:${r.author_id}`;
      const g = map.get(key);
      if (g) g.rows.push(r);
      else
        map.set(key, {
          key,
          listId: r.list_id,
          who: r.is_own ? 'You' : (r.author_name ?? r.author_handle ?? 'Someone'),
          avatar: r.author_avatar,
          listTitle: r.list_title,
          // A group is one author's vouches, so the tier is shared across rows.
          tier: vouchTier(r),
          rows: [r],
        });
    }
    return [...map.values()];
  }, [results]);

  return (
    <Page>
      <StatusSpace />
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Text style={styles.headline}>What are you after?</Text>

        <View style={styles.searchPill}>
          <Text style={styles.searchGlyph}>⌕</Text>
          <TextInput
            accessibilityLabel="Search"
            placeholder="A place, a spot, a dish…"
            placeholderTextColor={FAINT}
            value={destination}
            onChangeText={setDestination}
            style={styles.searchInput}
            selectionColor={CORAL}
          />
        </View>

        {/* Persistent path to Ask (Loop C) — on-demand supply. Previously this
            was only reachable from the no-results empty state, so Ask was
            effectively invisible whenever search returned anything. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ask your circle about a destination"
          onPress={() =>
            router.push({
              pathname: '/(tabs)/ask',
              params: trimmed ? { destination: trimmed } : {},
            } as never)
          }
          hitSlop={12}
          style={styles.askRow}
        >
          <Text style={styles.askRowLabel}>Going somewhere? Ask your circle →</Text>
        </Pressable>

        {showHint ? (
          <Text style={styles.hint}>
            Search a place, a restaurant, or a dish — see what your circle vouched for, in their
            words.
          </Text>
        ) : q.isLoading ? (
          <Text style={styles.hint}>Searching…</Text>
        ) : showNoResults ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Nothing from your circle yet.</Text>
            <Text style={styles.emptyBody}>
              No one in your network has vouched for "{trimmed}". Ask them directly.
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Ask your circle"
              onPress={() =>
                router.push({ pathname: '/(tabs)/ask', params: { destination: trimmed } } as never)
              }
              style={styles.askBtn}
            >
              <Text style={styles.askLabel}>Ask your circle</Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ marginTop: 18, gap: 22 }}>
            <Eyebrow>
              {results.length} vouch{results.length === 1 ? '' : 'es'} for {trimmed}
            </Eyebrow>
            {groups.map((g) => (
              <View key={g.key} style={{ gap: 10 }}>
                {/* List header — the person + the list these came from */}
                <View style={styles.tripHeader}>
                  <Face uri={g.avatar} initials={g.who.slice(0, 2).toUpperCase()} size="sm" />
                  <Text style={styles.tripWho}>{g.who}</Text>
                  {g.tier === 'fof' ? (
                    <View style={styles.fofBadge}>
                      <Text style={styles.fofBadgeLabel}>Friend of a friend</Text>
                    </View>
                  ) : null}
                  {g.listTitle ? (
                    <>
                      <Text style={styles.dot}>·</Text>
                      <Text style={styles.tripTitle} numberOfLines={1}>
                        {g.listTitle}
                      </Text>
                    </>
                  ) : null}
                </View>

                {g.rows.map((r) => {
                  const pill = TYPE_PILL[r.vouch_type];
                  const isSaved = savedIds.data?.has(r.vouch_id) ?? false;
                  const onSave = async () => {
                    if (isSaved) return;
                    try {
                      await saveVouch.mutateAsync({
                        vouchId: r.vouch_id,
                        destinationText: r.destination_text,
                      });
                      // Saving someone's vouch is the strongest revealed-trust
                      // signal — record it (single-fire here, not in the save
                      // hook, so it logs once per user save action).
                      recordInteraction.mutate({ vouchId: r.vouch_id, kind: 'save' });
                      toast.show({
                        message: `Saved to your ${r.destination_text} plan.`,
                        variant: 'success',
                      });
                    } catch (err) {
                      log.error('save vouch failed', err);
                      toast.show({ message: 'Could not save. Try again.', variant: 'error' });
                    }
                  };
                  return (
                    <Pressable
                      key={r.vouch_id}
                      accessibilityRole="button"
                      accessibilityLabel={`${pill.label}: ${r.vouch_text}`}
                      onPress={() =>
                        r.list_id ? router.push(`/(tabs)/list/${r.list_id}` as never) : undefined
                      }
                      style={styles.vouchCard}
                    >
                      <View style={styles.vouchHead}>
                        <View style={[styles.pill, { backgroundColor: pill.bg }]}>
                          <Text style={[styles.pillLabel, { color: pill.fg }]}>{pill.label}</Text>
                        </View>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={isSaved ? 'Saved' : 'Save to plan'}
                          onPress={onSave}
                          hitSlop={8}
                          style={styles.saveBtn}
                        >
                          <Text style={[styles.saveGlyph, isSaved && styles.saveGlyphOn]}>
                            {isSaved ? 'Saved' : '+ Save'}
                          </Text>
                        </Pressable>
                      </View>
                      <Text style={styles.vouchText}>"{r.vouch_text}"</Text>
                      <Text style={styles.reason}>{vouchReason(r)}</Text>
                      <View style={styles.actions}>
                        {PLACE_TYPES.has(r.vouch_type) ? (
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel="Open in Maps"
                            onPress={() => openMaps(r)}
                            hitSlop={12}
                            style={styles.actionBtn}
                          >
                            {/* A resolved vouch drops a precise pin (query_place_id
                                in openMaps). Label stays glyph-safe — emoji don't
                                render in the custom font (they show as a "?" box). */}
                            <Text style={styles.actionLabel}>
                              {r.place_google_id ? '↗ Maps · pinned' : '↗ Maps'}
                            </Text>
                          </Pressable>
                        ) : null}
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="Share this vouch"
                          onPress={() => shareVouch(r)}
                          hitSlop={12}
                          style={styles.actionBtn}
                        >
                          <Text style={styles.actionLabel}>Share</Text>
                        </Pressable>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
        )}
        <View style={{ height: 48 }} />
      </ScrollView>
    </Page>
  );
}

const styles = StyleSheet.create({
  headline: {
    fontFamily: 'PlayfairDisplay_500Medium',
    fontSize: 34,
    lineHeight: 38,
    color: INK,
    letterSpacing: -0.8,
    marginTop: 16,
  },
  searchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: TINT,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 16,
  },
  searchGlyph: { fontSize: 18, color: MUTE },
  searchInput: {
    flex: 1,
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    color: INK,
    paddingVertical: 2,
  },
  hint: {
    marginTop: 20,
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    lineHeight: 20,
    color: MUTE,
  },
  emptyCard: {
    marginTop: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: HAIR,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
  },
  emptyTitle: {
    fontFamily: 'PlayfairDisplay_500Medium',
    fontSize: 22,
    color: INK,
    letterSpacing: -0.4,
  },
  emptyBody: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    lineHeight: 20,
    color: MUTE,
    marginTop: 8,
  },
  askBtn: {
    marginTop: 16,
    backgroundColor: CORAL,
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
  },
  askLabel: { fontFamily: 'DMSans_600SemiBold', fontSize: 14, color: '#FFFFFF' },
  askRow: { marginTop: 12, alignSelf: 'flex-start' },
  askRowLabel: { fontFamily: 'DMSans_600SemiBold', fontSize: 13, color: CORAL },
  tripHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tripWho: { fontFamily: 'DMSans_600SemiBold', fontSize: 14, color: INK },
  dot: { color: FAINT },
  tripTitle: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: MUTE, flexShrink: 1 },
  // Weak-tie cue: a quiet outlined chip, not a coral accent — a FoF is supply
  // to surface, not something to shout. Reads differently from a direct friend.
  fofBadge: {
    borderWidth: 1,
    borderColor: HAIR,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: TINT,
  },
  fofBadgeLabel: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 10,
    letterSpacing: 0.3,
    color: MUTE,
  },
  vouchCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: HAIR,
    padding: 14,
  },
  vouchHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  pillLabel: { fontFamily: 'DMSans_600SemiBold', fontSize: 11, letterSpacing: 0.3 },
  saveBtn: { paddingHorizontal: 4, paddingVertical: 2 },
  saveGlyph: { fontFamily: 'DMSans_600SemiBold', fontSize: 13, color: CORAL },
  saveGlyphOn: { fontSize: 15 },
  vouchText: {
    fontFamily: 'PlayfairDisplay_500Medium_Italic',
    fontSize: 17,
    lineHeight: 24,
    color: INK,
    marginTop: 10,
  },
  reason: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 11,
    letterSpacing: 0.4,
    color: FAINT,
    textTransform: 'uppercase',
    marginTop: 10,
  },
  actions: { flexDirection: 'row', gap: 8, marginTop: 14 },
  actionBtn: {
    borderWidth: 1,
    borderColor: HAIR,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  actionLabel: { fontFamily: 'DMSans_600SemiBold', fontSize: 12.5, color: INK },
});
