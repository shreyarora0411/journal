import { Page, PlacePicker, StatusSpace } from '@/components';
import { useToast } from '@/hooks/use-toast';
import type { PlaceDetails } from '@/lib/google-places';
import { hapticImpactMedium, hapticSuccess } from '@/lib/haptics';
import { log } from '@/lib/log';
import {
  ALL_HUBS,
  DELHI_HUBS,
  FORMAT_TAGS,
  GURGAON_HUBS,
  OCCASION_TAGS,
  type Sentiment,
  inferZone,
} from '@journal/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from 'react-native-reanimated';
import { useLogPlace } from '../api/use-log-place';
import {
  CORAL,
  HAIR,
  INK,
  MUTE,
  SANS,
  SANS_BOLD,
  SANS_SEMI,
  SERIF,
  TASTE_TYPE_SCALE,
  TINT,
} from '../lib/taste-tokens';

// No sublabels: naming which button feeds the algorithm invites performative
// logging. How signals work lives on the how-it-works surface, not here.
const SENTIMENTS: { key: Sentiment; label: string }[] = [
  { key: 'loved', label: 'Loved it' },
  { key: 'fine', label: 'Fine' },
  { key: 'skip', label: 'Skip' },
];

// Shared by the place search input and the note input below it — one
// border/placeholder/font treatment for both text inputs on this form,
// instead of PlacePicker silently falling back to its own older defaults.
const INPUT_PLACEHOLDER_COLOR = '#B7AE9F';

// find_or_create_place (the log mutation's RPC) requires a non-empty
// google_place_id — it's the canonical key places are keyed on. A free-text
// place (Google/the seeded corpus couldn't find it) has no real one, so
// synthesize a stable one from the typed name, the same trick
// framing-screen.tsx uses for its Gurgaon quick-pick's fake id.
const freeTextPlaceId = (name: string) => {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `free-text-${slug || Date.now()}`;
};

// A tiny scale pulse so the tap reads as registered before the mutation even
// starts — the network round-trip is invisible, the tap shouldn't be.
function SentimentChip({
  sentiment,
  active,
  onPress,
}: {
  sentiment: { key: Sentiment; label: string };
  active: boolean;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);

  useEffect(() => {
    if (!active) return;
    scale.value = withSequence(
      withSpring(1.08, { damping: 9, stiffness: 260 }),
      withSpring(1, { damping: 12 }),
    );
  }, [active, scale]);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={[{ flex: 1 }, animatedStyle]}>
      <Pressable
        accessibilityRole="radio"
        accessibilityLabel={sentiment.label}
        accessibilityState={{ selected: active }}
        onPress={onPress}
        style={[
          styles.sentimentBtn,
          active && sentiment.key === 'loved' && styles.sentimentLovedOn,
          active && sentiment.key === 'fine' && styles.sentimentFineOn,
          active && sentiment.key === 'skip' && styles.sentimentSkipOn,
        ]}
      >
        <Text style={[styles.sentimentLabel, active && { color: '#FFFFFF' }]}>
          {sentiment.label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

/**
 * Log — the 10-second door (spec §3, screen 2). Place → one-tap sentiment →
 * optional voiced note → optional ≤3 tags → save. Only place + sentiment are
 * required; everything else is best-effort extras. Sentiment is PRIVATE.
 */
export function LogPlaceScreen() {
  const router = useRouter();
  const toast = useToast();
  const logPlace = useLogPlace();
  // Arriving from a list's "+ Write a vouch" (list-detail-vouches-screen)
  // carries list context so the new vouch lands back in that list instead
  // of silently dropping the intent the user came here with.
  const { listId, listTitle } = useLocalSearchParams<{ listId?: string; listTitle?: string }>();

  const [place, setPlace] = useState<PlaceDetails | null>(null);
  const [sentiment, setSentiment] = useState<Sentiment | null>(null);
  const [note, setNote] = useState('');
  const [dishes, setDishes] = useState<string[]>([]);
  const [dishDraft, setDishDraft] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [occasion, setOccasion] = useState<string | null>(null);
  const [hub, setHub] = useState<string | null>(null);
  // Collapsed by default (design critique: three walls of chips at once).
  // A recognized hub still gets silently auto-set below even while this
  // stays collapsed — the user only needs to open it to override or add
  // tags/occasion.
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    log.event('taste.log_entered');
  }, []);

  const toggleTag = (slug: string) =>
    setTags((prev) =>
      prev.includes(slug)
        ? prev.filter((t) => t !== slug)
        : prev.length < 3
          ? [...prev, slug]
          : prev,
    );

  const addDish = (raw: string) => {
    const dish = raw.trim().slice(0, 40);
    if (!dish) return;
    setDishes((prev) =>
      prev.length >= 3 || prev.some((d) => d.toLowerCase() === dish.toLowerCase())
        ? prev
        : [...prev, dish],
    );
  };

  // Comma commits a chip mid-typing, same as return — "raan, kokum fizz"
  // pasted or typed in one go still lands as separate dishes.
  const onDishDraftChange = (t: string) => {
    if (!t.includes(',')) {
      setDishDraft(t);
      return;
    }
    const parts = t.split(',');
    const rest = parts.pop() ?? '';
    for (const part of parts) addDish(part);
    setDishDraft(rest.trimStart());
  };

  const commitDishDraft = () => {
    addDish(dishDraft);
    setDishDraft('');
  };

  const reset = () => {
    setPlace(null);
    setSentiment(null);
    setNote('');
    setDishes([]);
    setDishDraft('');
    setTags([]);
    setOccasion(null);
    setHub(null);
    setDetailsOpen(false);
  };

  // A canonical hit already carries its hub from the server (PlacePicker);
  // trust that instead of making the user re-tap a pill for a place the
  // system already recognizes. Raw Google Places hits (e.g. travelling)
  // have no hub — leave the existing manual, optional selection alone.
  const onPickPlace = (details: PlaceDetails) => {
    setPlace(details);
    if (details.hub) setHub(details.hub);
  };

  // The "Use "X" anyway" escape hatch — without this wired, any place Google
  // and the seeded corpus can't find was a dead end with no way to log it.
  const onFreeTextPlace = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onPickPlace({
      google_place_id: freeTextPlaceId(trimmed),
      name: trimmed,
      country: null,
      country_iso: null,
      region: null,
      locality: null,
      lat: null,
      lng: null,
      types: [],
    });
  };

  const onSave = async () => {
    if (!place || !sentiment || logPlace.isPending) return;
    // A place must land in SOME zone to surface in Go Out. The picked hub
    // decides; otherwise infer from coordinates — out-of-market logs
    // (travel) honestly stay zone-less.
    const zone = hub
      ? (ALL_HUBS.find((h) => h.slug === hub)?.zone ?? null)
      : inferZone(place.lat, place.lng);
    // An uncommitted draft still counts — Save must not eat a typed dish
    // just because the user never hit return/comma.
    const draft = dishDraft.trim();
    const dishesToSave = draft ? [...dishes, draft] : dishes;
    try {
      const result = await logPlace.mutateAsync({
        place,
        sentiment,
        note: note.trim() || undefined,
        dishes: dishesToSave,
        tags,
        occasion,
        hub,
        zone,
        listId,
      });
      hapticSuccess();
      if (!result.noteSaved) {
        // Keep the whole form: the sentiment saved (idempotent on re-save),
        // the note didn't — one more Save retries exactly that.
        toast.show({
          message: "Saved how it was, but your note didn't stick — tap Save again.",
          variant: 'error',
        });
        return;
      }
      if (listId && !result.addedToList) {
        // A list holds vouches, not bare reactions — no note means nothing
        // was written to attach. Say so instead of silently dropping the
        // list context the user arrived with.
        toast.show({
          message: note.trim()
            ? `Saved — but couldn't add it to ${listTitle || 'your list'}. Try "+ Add existing" from the list.`
            : `Saved to your map. Add a word or two next time to include it in ${listTitle || 'your list'}.`,
          variant: note.trim() ? 'error' : 'success',
        });
        reset();
        return;
      }
      toast.show({
        message: listId
          ? `${place.name} is on your map — and in ${listTitle || 'your list'}.`
          : `${place.name} is on your map.`,
        variant: 'success',
      });
      reset();
    } catch (err) {
      log.error('log place failed', err);
      toast.show({ message: 'Could not save. Try again.', variant: 'error' });
    }
  };

  const canSave = Boolean(place && sentiment) && !logPlace.isPending;

  return (
    <Page>
      <StatusSpace />
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Text style={styles.headline}>Log a place.</Text>
        <Text style={styles.sub}>Your map, your taste — ten seconds.</Text>
        {listId ? (
          <View style={styles.listBanner}>
            <Text style={styles.listBannerText}>
              Adding to <Text style={styles.listBannerTitle}>{listTitle || 'your list'}</Text> — a
              note is what makes it count.
            </Text>
          </View>
        ) : null}

        {/* 1. The place */}
        <Text style={styles.eyebrow}>WHERE</Text>
        {place ? (
          <View style={styles.pickedRow}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.pickedName} numberOfLines={1}>
                {place.name}
              </Text>
              <Text style={styles.pickedMeta} numberOfLines={1}>
                {place.locality ?? place.region ?? ''}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Change place"
              onPress={() => setPlace(null)}
              hitSlop={12}
            >
              <Text style={styles.changeLink}>Change</Text>
            </Pressable>
          </View>
        ) : (
          <PlacePicker
            mode="broad"
            placeholder="Search the place…"
            onPick={onPickPlace}
            onFreeText={onFreeTextPlace}
            borderColor={HAIR}
            placeholderTextColor={INPUT_PLACEHOLDER_COLOR}
            inputFontFamily={SANS}
          />
        )}

        {/* 2. The one-tap sentiment (required, private) */}
        {place ? (
          <>
            <Text style={styles.eyebrow}>HOW WAS IT?</Text>
            <View style={styles.sentimentRow}>
              {SENTIMENTS.map((s) => (
                <SentimentChip
                  key={s.key}
                  sentiment={s}
                  active={sentiment === s.key}
                  onPress={() => {
                    hapticImpactMedium();
                    setSentiment(s.key);
                  }}
                />
              ))}
            </View>

            {/* 3. The voiced note (optional, public) */}
            <Text style={styles.eyebrow}>SAY IT IN YOUR WORDS (OPTIONAL)</Text>
            <TextInput
              accessibilityLabel="Your note"
              placeholder="“Get the corner table, order the raan…”"
              placeholderTextColor={INPUT_PLACEHOLDER_COLOR}
              value={note}
              onChangeText={(t) => setNote(t.slice(0, 500))}
              maxLength={500}
              multiline
              style={styles.noteInput}
              selectionColor={CORAL}
            />
            {note.length > 400 ? (
              <Text style={styles.noteCount}>{500 - note.length} characters left</Text>
            ) : null}

            {/* 3b. What to order (optional, ≤3) — a first-class ask beside
                the note, NOT detail: the order is the most borrowable thing
                a lover knows. Return or comma commits a chip. */}
            <Text style={styles.eyebrow}>WHAT SHOULD THEY ORDER? (OPTIONAL)</Text>
            {dishes.length > 0 ? (
              <View style={styles.dishWrap}>
                {dishes.map((d) => (
                  <View key={d} style={styles.dishChip}>
                    <Text style={styles.dishChipLabel} numberOfLines={1}>
                      {d}
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${d}`}
                      onPress={() => setDishes((prev) => prev.filter((x) => x !== d))}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={styles.removeGlyph}>✕</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : null}
            {dishes.length < 3 ? (
              <TextInput
                accessibilityLabel="What should they order"
                placeholder="raan, kokum fizz…"
                placeholderTextColor={INPUT_PLACEHOLDER_COLOR}
                value={dishDraft}
                onChangeText={onDishDraftChange}
                onSubmitEditing={commitDishDraft}
                maxLength={40}
                returnKeyType="done"
                // Keep the keyboard up after return — most people add a
                // second dish right away.
                submitBehavior="submit"
                style={[styles.dishInput, dishes.length > 0 && { marginTop: 8 }]}
                selectionColor={CORAL}
              />
            ) : null}

            {/* 4. Tags/occasion/hub — collapsed by default (design critique:
                three walls of identical chips at once). A recognized hub is
                already silently set via onPickPlace; opening this is only
                for overriding it or adding tags/occasion. */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={detailsOpen ? 'Hide detail' : 'Add detail — kind, occasion, hub'}
              accessibilityState={{ expanded: detailsOpen }}
              onPress={() => setDetailsOpen((v) => !v)}
              style={styles.disclosureRow}
            >
              <Text style={styles.disclosureLabel}>
                {detailsOpen ? 'Hide detail' : 'Add detail — kind, occasion, hub'}
              </Text>
              <Text style={styles.disclosureChevron}>{detailsOpen ? '▴' : '▾'}</Text>
            </Pressable>

            {detailsOpen ? (
              <>
                {/* 4a. Tags (optional, ≤3) */}
                <Text style={styles.eyebrow}>WHAT KIND OF PLACE? (UP TO 3)</Text>
                <View style={styles.tagWrap}>
                  {FORMAT_TAGS.map((t) => {
                    const on = tags.includes(t.slug);
                    return (
                      <Pressable
                        key={t.slug}
                        accessibilityRole="button"
                        accessibilityLabel={t.label}
                        accessibilityState={{ selected: on }}
                        onPress={() => toggleTag(t.slug)}
                        style={[styles.tagChip, on && styles.tagChipOn]}
                      >
                        <Text style={[styles.tagLabel, on && { color: '#FFFFFF' }]}>{t.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>

                {/* 4b. Occasion (optional, single) — Go Out's occasion filter
                    matches on these votes; without them it returns nothing. */}
                <Text style={styles.eyebrow}>WHEN'S IT FOR? (OPTIONAL)</Text>
                <View style={styles.tagWrap}>
                  {OCCASION_TAGS.map((o) => {
                    const on = occasion === o.slug;
                    return (
                      <Pressable
                        key={o.slug}
                        accessibilityRole="button"
                        accessibilityLabel={o.label}
                        accessibilityState={{ selected: on }}
                        onPress={() => setOccasion(on ? null : o.slug)}
                        style={[styles.tagChip, on && styles.tagChipOn]}
                      >
                        <Text style={[styles.tagLabel, on && { color: '#FFFFFF' }]}>{o.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>

                {/* 4c. Hub (optional — both zones; the hub decides the zone) */}
                <Text style={styles.eyebrow}>HUB (OPTIONAL)</Text>
                <View style={styles.tagWrap}>
                  {GURGAON_HUBS.map((h) => {
                    const on = hub === h.slug;
                    return (
                      <Pressable
                        key={h.slug}
                        accessibilityRole="button"
                        accessibilityLabel={h.label}
                        accessibilityState={{ selected: on }}
                        onPress={() => setHub(on ? null : h.slug)}
                        style={[styles.tagChip, on && styles.tagChipOn]}
                      >
                        <Text style={[styles.tagLabel, on && { color: '#FFFFFF' }]}>{h.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Text style={styles.zoneSub}>DELHI</Text>
                <View style={styles.tagWrap}>
                  {DELHI_HUBS.map((h) => {
                    const on = hub === h.slug;
                    return (
                      <Pressable
                        key={h.slug}
                        accessibilityRole="button"
                        accessibilityLabel={h.label}
                        accessibilityState={{ selected: on }}
                        onPress={() => setHub(on ? null : h.slug)}
                        style={[styles.tagChip, on && styles.tagChipOn]}
                      >
                        <Text style={[styles.tagLabel, on && { color: '#FFFFFF' }]}>{h.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            ) : null}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Save to your map"
              onPress={onSave}
              disabled={!canSave}
              style={[styles.save, !canSave && styles.saveDisabled]}
            >
              <Text style={styles.saveLabel}>
                {logPlace.isPending ? 'Saving…' : 'Save to your map'}
              </Text>
            </Pressable>
            {!sentiment ? (
              <Text style={styles.saveHint}>Pick how it was — that's the log.</Text>
            ) : null}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back to your map"
              onPress={() => router.push('/(tabs)/book' as never)}
              hitSlop={8}
              style={{ alignSelf: 'center', marginTop: 14 }}
            >
              <Text style={styles.doneLink}>Back to your map</Text>
            </Pressable>
          </>
        ) : null}
        <View style={{ height: 60 }} />
      </ScrollView>
    </Page>
  );
}

const styles = StyleSheet.create({
  headline: { fontFamily: SERIF, fontSize: 30, color: INK, letterSpacing: -0.6, paddingTop: 8 },
  sub: { fontFamily: SANS, fontSize: TASTE_TYPE_SCALE.subhead, color: MUTE, marginTop: 6 },
  listBanner: {
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: TINT,
    borderWidth: 1,
    borderColor: HAIR,
  },
  listBannerText: {
    fontFamily: SANS,
    fontSize: TASTE_TYPE_SCALE.body,
    color: MUTE,
    lineHeight: 19,
  },
  listBannerTitle: { fontFamily: SANS_SEMI, color: INK },
  eyebrow: {
    fontFamily: SANS_BOLD,
    fontSize: TASTE_TYPE_SCALE.micro,
    letterSpacing: 1.4,
    color: CORAL,
    marginTop: 22,
    marginBottom: 10,
  },
  zoneSub: {
    fontFamily: SANS_BOLD,
    fontSize: TASTE_TYPE_SCALE.micro,
    letterSpacing: 1.4,
    color: MUTE,
    marginTop: 12,
    marginBottom: 10,
  },
  noteCount: { fontFamily: SANS, fontSize: 11.5, color: MUTE, marginTop: 6 },
  disclosureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 22,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderColor: HAIR,
  },
  disclosureLabel: { fontFamily: SANS_SEMI, fontSize: 13.5, color: INK },
  disclosureChevron: { fontFamily: SANS_SEMI, fontSize: TASTE_TYPE_SCALE.body, color: MUTE },
  pickedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: HAIR,
    backgroundColor: TINT,
  },
  pickedName: { fontFamily: SERIF, fontSize: TASTE_TYPE_SCALE.headline, color: INK },
  pickedMeta: { fontFamily: SANS, fontSize: 12.5, color: MUTE, marginTop: 2 },
  changeLink: { fontFamily: SANS_SEMI, fontSize: TASTE_TYPE_SCALE.body, color: CORAL },
  sentimentRow: { flexDirection: 'row', gap: 8 },
  sentimentBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: HAIR,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    gap: 2,
  },
  sentimentLovedOn: { backgroundColor: CORAL, borderColor: CORAL },
  sentimentFineOn: { backgroundColor: MUTE, borderColor: MUTE },
  sentimentSkipOn: { backgroundColor: INK, borderColor: INK },
  sentimentLabel: { fontFamily: SANS_SEMI, fontSize: TASTE_TYPE_SCALE.subhead, color: INK },
  noteInput: {
    fontFamily: SANS,
    fontSize: 16,
    lineHeight: 23,
    color: INK,
    minHeight: 72,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: HAIR,
    borderRadius: 14,
    padding: 12,
    backgroundColor: '#FFFFFF',
  },
  dishWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dishChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: HAIR,
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 7,
    backgroundColor: '#FFFFFF',
  },
  dishChipLabel: {
    fontFamily: SANS_SEMI,
    fontSize: TASTE_TYPE_SCALE.body,
    color: INK,
    maxWidth: 200,
  },
  // Same treatment as taste-setup-screen's picked-row remove.
  removeGlyph: { fontSize: TASTE_TYPE_SCALE.subhead, color: MUTE },
  // The note input's border/placeholder/font treatment, single-line.
  dishInput: {
    fontFamily: SANS,
    fontSize: 16,
    color: INK,
    borderWidth: 1,
    borderColor: HAIR,
    borderRadius: 14,
    padding: 12,
    backgroundColor: '#FFFFFF',
  },
  tagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  // Geometry + selected fill match go-out-screen's hub/occasion chips —
  // both screens render the same underlying tags and previously disagreed
  // on padding/font-size/selected-fill-color.
  tagChip: {
    borderWidth: 1,
    borderColor: HAIR,
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 7,
    backgroundColor: '#FFFFFF',
  },
  tagChipOn: { backgroundColor: CORAL, borderColor: CORAL },
  tagLabel: { fontFamily: SANS_SEMI, fontSize: TASTE_TYPE_SCALE.body, color: INK },
  save: {
    marginTop: 26,
    backgroundColor: CORAL,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  saveDisabled: { opacity: 0.4 },
  saveLabel: { fontFamily: SANS_SEMI, fontSize: TASTE_TYPE_SCALE.emphasis, color: '#FFFFFF' },
  saveHint: {
    fontFamily: SANS,
    fontSize: TASTE_TYPE_SCALE.label,
    color: MUTE,
    textAlign: 'center',
    marginTop: 8,
  },
  doneLink: { fontFamily: SANS_SEMI, fontSize: TASTE_TYPE_SCALE.body, color: MUTE },
});
