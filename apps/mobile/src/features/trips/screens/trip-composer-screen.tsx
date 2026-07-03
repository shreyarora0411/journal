import { Eyebrow, Page, StatusSpace } from '@/components';
import { useOpenAskForDestination } from '@/features/ask';
import { useBackfillMyPlaces, useResolveVouchPlace } from '@/features/places';
import { useToast } from '@/hooks/use-toast';
import { log } from '@/lib/log';
import { VOUCH_CATEGORIES, type VouchType, looksSpecific } from '@journal/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useCreateVouch } from '../index';

const CORAL = '#FF4D2E';
const INK = '#1A1410';
const MUTE = '#7A716A';
const FAINT = '#B7AE9F';
const HAIR = '#EFEAE2';
const TINT = '#FAF6F0';

// Short chip labels — the full category prompts ("Where to eat or drink?") wrap
// awkwardly; these scan in one glance and match the list/search surfaces.
const SHORT_LABEL: Record<VouchType, string> = {
  stay: 'Stay',
  eat_drink: 'Eat / Drink',
  do: 'Do',
  nightlife: 'Nightlife',
  good_to_know: 'Good to know',
  skip: 'Skip',
};

/**
 * Add vouches (Vouched v3.1 — batch composer). The VOUCH is the atom; a LIST
 * is an optional folder. Two doors:
 *
 *   - FAST (Add tab, no listId): log STANDALONE vouches — no "which list?"
 *     wall at all. The vouch still surfaces in search, the circle feed, and
 *     your profile. This is the wedge: log a place in seconds.
 *   - CURATE ("+ Add a vouch" from a list): listId/listTitle params prefill +
 *     lock the list, so everything batches into that list.
 *
 * Per vouch: category → one tuned field → destination (defaults to the
 * last one used, so a multi-stop trip rarely retypes). "Save & add another"
 * banks it and stays put. No verdict (the voiced text carries sentiment).
 *
 * There's no find-or-create-by-name anymore (curate already has a list id;
 * fast has no list), so every save is optimistic-with-rollback.
 */
export function TripComposerScreen() {
  const router = useRouter();
  const toast = useToast();
  const create = useCreateVouch();
  const resolveVouchPlace = useResolveVouchPlace();
  const backfillMyPlaces = useBackfillMyPlaces();
  const params = useLocalSearchParams<{
    listId?: string;
    listTitle?: string;
    destination?: string;
  }>();

  // CURATE mode is keyed entirely off the listId param. When set, the list is
  // shown + locked and every vouch batches into it. When absent, we're in FAST
  // mode: no list field, standalone vouches.
  const lockedListId = typeof params.listId === 'string' ? params.listId : null;
  const lockedListTitle = typeof params.listTitle === 'string' ? params.listTitle : '';

  const [vouchType, setVouchType] = useState<VouchType | null>(null);
  const [text, setText] = useState('');
  const [destination, setDestination] = useState(
    typeof params.destination === 'string' ? params.destination : '',
  );
  const [banked, setBanked] = useState(0);

  // A REAL beneficiary for the destination being logged: someone in the circle
  // with an open ask about it. Powers an honest, concrete peak-end reward ("Mira
  // asked about Goa — your vouch answers her") instead of a fabricated date.
  const askForDest = useOpenAskForDestination(destination);

  useEffect(() => {
    log.event('composer.screen_entered', { batch: true, mode: lockedListId ? 'curate' : 'fast' });
  }, [lockedListId]);

  // Kick the place backfill once on mount, in the background — existing
  // place-type vouches with no link get a precise pin without any UI or
  // blocking. Fire-and-forget: the hook swallows its own errors. Run once;
  // backfillMyPlaces is a stable callback keyed only off the user id.
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional once-on-mount kick
  useEffect(() => {
    void backfillMyPlaces();
  }, []);

  const category = VOUCH_CATEGORIES.find((c) => c.type === vouchType) ?? null;
  // Fast mode needs only category + text + destination; curate adds nothing for
  // the user (the locked list is implicit), so the gate is the same shape.
  const canSave = Boolean(vouchType) && text.trim().length > 0 && destination.trim().length > 0;
  const nudge = text.trim().length > 0 && !looksSpecific(text);
  // What's still missing — shown inline so the disabled CTA isn't a silent wall.
  // (vouchType is always set wherever the CTA renders, so it's omitted here.)
  const missing = [
    text.trim().length === 0 && 'the vouch',
    destination.trim().length === 0 && 'where',
  ].filter(Boolean) as string[];

  const onSaveAndNext = () => {
    if (!canSave || !vouchType) return; // guarded by the disabled CTA + inline hint
    const snap = { vouchType, text: text.trim(), destination: destination.trim() };

    // Optimistic in both modes: bank + clear instantly so the next vouch can be
    // typed now; persist in the background, roll back on error. CURATE links to
    // the locked list; FAST stays standalone (list_id AND new_list_name null).
    // Destination is intentionally retained between saves (next stop is usually
    // the same).
    setBanked((n) => n + 1);
    setText('');
    setVouchType(null);
    create
      .mutateAsync({
        vouch_type: snap.vouchType,
        text: snap.text,
        destination_text: snap.destination,
        list_id: lockedListId,
        new_list_name: null,
        visibility: 'friends_of_friends',
      })
      .then((res) => {
        // Background: link this vouch to a precise venue. Fire-and-forget —
        // do NOT await, never blocks the next vouch, swallows its own errors.
        resolveVouchPlace.mutate({
          vouchId: res.vouchId,
          text: snap.text,
          destinationText: snap.destination,
          vouchType: snap.vouchType,
        });
      })
      .catch((err) => {
        log.error('createVouch failed', err);
        setBanked((n) => Math.max(0, n - 1));
        setText(snap.text);
        setVouchType(snap.vouchType);
        toast.show({ message: 'Could not save that one — restored it.', variant: 'error' });
      });
  };

  const onDone = () => {
    // End on a high: name the gift, not just "saved" (peak-end + concern-for-
    // others). If a real circle member has an open ask for this place, name them
    // — a true, concrete beneficiary beats a generic line. Never a fabricated
    // "going in March": this fires only when someone actually asked.
    if (banked > 0) {
      const beneficiary = askForDest.data;
      const message = beneficiary
        ? `${beneficiary.requester_name} asked your circle about ${beneficiary.destination_text} — your ${banked === 1 ? 'vouch answers' : 'vouches answer'} them.`
        : `${banked} vouch${banked === 1 ? '' : 'es'} banked — the next friend headed here will find ${banked === 1 ? 'it' : 'them'}.`;
      toast.show({ message, variant: 'success' });
    }
    // Curate → back to the list. Fast → your profile, where the vouches surface.
    if (lockedListId) router.replace(`/(tabs)/list/${lockedListId}` as never);
    else router.replace('/(tabs)/you' as never);
  };

  return (
    <Page>
      <StatusSpace />
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.headerRow}>
          <Text style={styles.headline}>Add vouches.</Text>
          {banked > 0 ? (
            <View style={styles.bankChip}>
              <Text style={styles.bankChipLabel}>{banked} banked</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.sub}>
          Leave notes for the next friend headed here — in your own words.
        </Text>

        {/* CURATE mode only: show the locked list this batch lands in. FAST mode
            (no listId) has no "which list?" wall — vouches are standalone. */}
        {lockedListId ? (
          <>
            <View style={styles.field}>
              <Eyebrow>Adding to</Eyebrow>
              <View style={styles.lockedList}>
                <Text style={styles.lockedListLabel}>{lockedListTitle || 'This list'}</Text>
              </View>
            </View>
            <View style={styles.divider} />
          </>
        ) : null}

        {/* Per-vouch: category → field → destination */}
        <View style={styles.field}>
          <Eyebrow>What kind?</Eyebrow>
          <View style={styles.catRow}>
            {VOUCH_CATEGORIES.map((c) => {
              const on = vouchType === c.type;
              return (
                <Pressable
                  key={c.type}
                  accessibilityRole="button"
                  accessibilityLabel={c.prompt}
                  onPress={() => setVouchType(c.type)}
                  style={[styles.catChip, on ? styles.catChipOn : styles.catChipOff]}
                >
                  <Text style={[styles.catLabel, on ? styles.catLabelOn : styles.catLabelOff]}>
                    {SHORT_LABEL[c.type]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {category ? (
          <>
            <View style={styles.field}>
              <Eyebrow>
                {category.hint ? `${category.prompt}  ·  ${category.hint}` : category.prompt}
              </Eyebrow>
              <View style={styles.voiceCard}>
                <TextInput
                  accessibilityLabel="The vouch"
                  placeholder={category.placeholder}
                  placeholderTextColor={FAINT}
                  value={text}
                  onChangeText={(v) => setText(v.slice(0, 500))}
                  multiline
                  style={styles.voiceInput}
                  selectionColor={CORAL}
                  autoFocus
                />
              </View>
              {nudge ? <Text style={styles.nudge}>One place, dish, or specific thing?</Text> : null}
            </View>

            <View style={styles.field}>
              <Eyebrow>Where is this?</Eyebrow>
              <TextInput
                accessibilityLabel="Destination"
                placeholder="Spiti, Bangkok, Goa…"
                placeholderTextColor={FAINT}
                value={destination}
                onChangeText={setDestination}
                style={styles.input}
                selectionColor={CORAL}
              />
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Save and add another"
              onPress={onSaveAndNext}
              disabled={!canSave}
              style={[styles.cta, !canSave && { opacity: 0.5 }]}
            >
              <Text style={styles.ctaLabel}>Save & add another</Text>
            </Pressable>
            {!canSave ? (
              <Text style={styles.needHint}>Still need {missing.join(', ')}.</Text>
            ) : null}
          </>
        ) : null}

        {banked > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Done"
            onPress={onDone}
            style={styles.doneBtn}
          >
            <Text style={styles.doneLabel}>
              {lockedListId ? 'Done — see the list ›' : 'Done — see your vouches ›'}
            </Text>
          </Pressable>
        ) : null}
        <View style={{ height: 48 }} />
      </ScrollView>
    </Page>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  headline: {
    fontFamily: 'PlayfairDisplay_500Medium',
    fontSize: 32,
    lineHeight: 36,
    color: INK,
    letterSpacing: -0.6,
  },
  bankChip: {
    backgroundColor: CORAL,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  bankChipLabel: { fontFamily: 'DMSans_600SemiBold', fontSize: 12, color: '#FFFFFF' },
  sub: { fontFamily: 'DMSans_400Regular', fontSize: 14, lineHeight: 20, color: MUTE, marginTop: 6 },
  field: { marginTop: 22 },
  divider: { height: 1, backgroundColor: HAIR, marginTop: 22 },
  input: {
    marginTop: 8,
    fontFamily: 'DMSans_400Regular',
    fontSize: 17,
    color: INK,
    borderBottomWidth: 1,
    borderBottomColor: HAIR,
    paddingVertical: 8,
  },
  lockedList: {
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: TINT,
    borderWidth: 1,
    borderColor: HAIR,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  lockedListLabel: { fontFamily: 'PlayfairDisplay_500Medium', fontSize: 18, color: INK },
  catRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  catChip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999 },
  catChipOn: { backgroundColor: INK },
  catChipOff: { backgroundColor: TINT, borderWidth: 1, borderColor: HAIR },
  catLabel: { fontFamily: 'DMSans_600SemiBold', fontSize: 13.5 },
  catLabelOn: { color: '#FFFFFF' },
  catLabelOff: { color: MUTE },
  voiceCard: {
    marginTop: 8,
    backgroundColor: TINT,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: HAIR,
    padding: 14,
    minHeight: 96,
  },
  voiceInput: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 16,
    lineHeight: 24,
    color: INK,
    minHeight: 70,
    textAlignVertical: 'top',
  },
  nudge: { fontFamily: 'DMSans_400Regular', fontSize: 12, color: CORAL, marginTop: 6 },
  needHint: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    color: FAINT,
    textAlign: 'center',
    marginTop: 10,
  },
  cta: {
    backgroundColor: INK,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  ctaLabel: { fontFamily: 'DMSans_600SemiBold', fontSize: 16, color: '#FFFFFF' },
  doneBtn: { marginTop: 16, paddingVertical: 14, alignItems: 'center' },
  doneLabel: { fontFamily: 'DMSans_600SemiBold', fontSize: 15, color: CORAL },
});
