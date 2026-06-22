import { Eyebrow, Page, StatusSpace, VerdictPicker, type Verdict } from '@/components';
import { useToast } from '@/hooks/use-toast';
import { log } from '@/lib/log';
import {
  type AdviceType,
  type ConfirmedTip,
  type LogTipDraft,
} from '@journal/shared';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useCreateTripLog, useExtractTips } from '../index';

const CORAL = '#FF4D2E';
const INK = '#1A1410';
const MUTE = '#7A716A';
const FAINT = '#B7AE9F';
const HAIR = '#EFEAE2';
const TINT = '#FAF6F0';

// Faded real example that sits under the note box — register-setting.
const EXAMPLE_NOTE =
  'Stay at Banjara, book the tents. Skip Kaza unless you need supplies. Ask for Tashi for the monastery day.';

const ADVICE_LABELS: Record<AdviceType, string> = {
  do: 'Do',
  eat_drink: 'Eat / Drink',
  stay: 'Stay',
  book: 'Book',
  ask_contact: 'Ask',
  shop: 'Shop',
  skip: 'Skip',
  avoid: 'Avoid',
  area: 'Area',
  other: 'Other',
};
const ADVICE_ORDER: AdviceType[] = [
  'do',
  'eat_drink',
  'stay',
  'book',
  'ask_contact',
  'shop',
  'skip',
  'avoid',
  'area',
  'other',
];

/** A tip in the review list — a draft plus the editable status we track
 *  locally so a user-edited extraction reports honestly on save. */
type ReviewTip = {
  text: string;
  advice_type: AdviceType;
  area_text: string | null;
  confidence: number | null;
  extraction_status: ConfirmedTip['extraction_status'];
};

const toReviewTip = (d: LogTipDraft): ReviewTip => ({
  text: d.text,
  advice_type: d.advice_type,
  area_text: d.area_text ?? null,
  confidence: d.confidence,
  extraction_status: 'system_extracted',
});

/**
 * Trip composer (Vouched v2, Loop A) — the single most important screen.
 *
 * Two phases in one flow:
 *   compose → 4 friend-framed fields → "Find the tips"
 *   review  → confirm/edit/delete extracted tips → "Save & share"
 *
 * The note is the source of truth; tips are extracted from it and only
 * persisted after the user confirms. An empty extraction doesn't block
 * the save — it nudges (v2 §4C).
 */
export function TripComposerScreen() {
  const router = useRouter();
  const toast = useToast();
  const extract = useExtractTips();
  const createLog = useCreateTripLog();

  const [phase, setPhase] = useState<'compose' | 'review'>('compose');
  const [destination, setDestination] = useState('');
  const [verdict, setVerdict] = useState<Verdict>('love');
  const [note, setNote] = useState('');
  const [didDifferently, setDidDifferently] = useState('');

  const [tips, setTips] = useState<ReviewTip[]>([]);
  const [openTypeFor, setOpenTypeFor] = useState<number | null>(null);

  useEffect(() => {
    log.event('composer.screen_entered');
  }, []);

  const canExtract = destination.trim().length > 0 && note.trim().length > 0;

  const onFindTips = async () => {
    if (!canExtract) {
      toast.show({ message: 'Add a destination and a note first.', variant: 'error' });
      return;
    }
    try {
      const result = await extract.mutateAsync({
        destinationText: destination.trim(),
        originalNote: note.trim(),
      });
      setTips(result.tips.map(toReviewTip));
      setPhase('review');
    } catch (err) {
      log.error('extract-tips failed', err);
      // Transport failure — let them proceed to review with no tips so a
      // save is still possible (they can add tips by hand).
      setTips([]);
      setPhase('review');
      toast.show({ message: "Couldn't auto-read tips — add them by hand.", variant: 'info' });
    }
  };

  const updateTipText = (i: number, text: string) =>
    setTips((prev) =>
      prev.map((t, idx) =>
        idx === i
          ? { ...t, text, extraction_status: t.extraction_status === 'user_created' ? 'user_created' : 'user_edited' }
          : t,
      ),
    );

  const setTipType = (i: number, advice_type: AdviceType) => {
    setTips((prev) =>
      prev.map((t, idx) =>
        idx === i
          ? { ...t, advice_type, extraction_status: t.extraction_status === 'user_created' ? 'user_created' : 'user_edited' }
          : t,
      ),
    );
    setOpenTypeFor(null);
  };

  const deleteTip = (i: number) => setTips((prev) => prev.filter((_, idx) => idx !== i));

  const addBlankTip = () =>
    setTips((prev) => [
      ...prev,
      { text: '', advice_type: 'do', area_text: null, confidence: null, extraction_status: 'user_created' },
    ]);

  const onSave = async () => {
    const cleaned: ConfirmedTip[] = tips
      .filter((t) => t.text.trim().length > 0)
      .map((t) => ({
        text: t.text.trim(),
        advice_type: t.advice_type,
        area_text: t.area_text,
        extraction_status: t.extraction_status,
        confidence: t.confidence,
        visibility: 'friends_of_friends' as const,
      }));
    try {
      const res = await createLog.mutateAsync({
        form: {
          destination_text: destination.trim(),
          original_note: note.trim(),
          verdict,
          did_differently: didDifferently.trim() || undefined,
          visibility: 'friends_of_friends',
        },
        tips: cleaned,
      });
      toast.show({
        message:
          res.tipCount > 0
            ? `Saved — ${res.tipCount} tip${res.tipCount === 1 ? '' : 's'} live for your circle.`
            : 'Saved. Add a specific tip anytime to make it useful.',
        variant: 'success',
      });
      router.replace('/(tabs)/book');
    } catch (err) {
      log.error('createTripLog failed', err);
      toast.show({ message: 'Could not save. Try again.', variant: 'error' });
    }
  };

  // ---- compose phase ------------------------------------------------------
  if (phase === 'compose') {
    return (
      <Page>
        <StatusSpace />
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Text style={styles.headline}>Log a trip.</Text>
          <Text style={styles.sub}>Like texting a friend who's about to go.</Text>

          <View style={styles.field}>
            <Eyebrow>Where did you go?</Eyebrow>
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

          <View style={styles.field}>
            <Eyebrow>Worth it?</Eyebrow>
            <View style={{ marginTop: 8 }}>
              <VerdictPicker value={verdict} onChange={setVerdict} />
            </View>
          </View>

          <View style={styles.field}>
            <Eyebrow>If a friend were going, what's the one thing you'd tell them?</Eyebrow>
            <View style={styles.noteCard}>
              <TextInput
                accessibilityLabel="The one thing you'd tell a friend"
                placeholder="Stay at Banjara, book the tents…"
                placeholderTextColor={FAINT}
                value={note}
                onChangeText={(v) => setNote(v.slice(0, 4000))}
                multiline
                style={styles.noteInput}
                selectionColor={CORAL}
              />
            </View>
            <Text style={styles.example}>“{EXAMPLE_NOTE}”</Text>
          </View>

          <View style={styles.field}>
            <Eyebrow color={MUTE}>Anything you'd do differently? (optional)</Eyebrow>
            <View style={styles.noteCardSmall}>
              <TextInput
                accessibilityLabel="Anything you'd do differently"
                placeholder="Optional"
                placeholderTextColor={FAINT}
                value={didDifferently}
                onChangeText={(v) => setDidDifferently(v.slice(0, 2000))}
                multiline
                style={styles.noteInputSmall}
                selectionColor={CORAL}
              />
            </View>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Find the tips"
            onPress={onFindTips}
            disabled={!canExtract || extract.isPending}
            style={[styles.cta, (!canExtract || extract.isPending) && { opacity: 0.5 }]}
          >
            {extract.isPending ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.ctaLabel}>Find the tips →</Text>
            )}
          </Pressable>
          <View style={{ height: 40 }} />
        </ScrollView>
      </Page>
    );
  }

  // ---- review phase -------------------------------------------------------
  return (
    <Page>
      <StatusSpace />
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to editing"
          onPress={() => setPhase('compose')}
          hitSlop={8}
        >
          <Text style={styles.backGlyph}>‹ Edit note</Text>
        </Pressable>

        <Text style={styles.headline}>Confirm your tips.</Text>
        <Text style={styles.sub}>These become searchable for your circle. Edit or cut any.</Text>

        {/* Original note — source of truth, read-only. */}
        <View style={styles.sourceCard}>
          <Eyebrow color={MUTE}>{destination.trim()} · your note</Eyebrow>
          <Text style={styles.sourceText}>{note.trim()}</Text>
        </View>

        {tips.length === 0 ? (
          <View style={styles.nudgeCard}>
            <Text style={styles.nudgeGlyph}>🧭</Text>
            <Text style={styles.nudgeTitle}>No specific tip in there yet.</Text>
            <Text style={styles.nudgeBody}>
              What's one place, dish, or thing to do? Add it by hand — or save as-is and come back.
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add a tip by hand"
              onPress={addBlankTip}
              style={styles.addTipBtn}
            >
              <Text style={styles.addTipLabel}>+ Add a tip</Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ gap: 12, marginTop: 16 }}>
            {tips.map((t, i) => {
              const lowConfidence = t.confidence != null && t.confidence < 0.5;
              return (
                <View key={`tip-${i}`} style={styles.tipCard}>
                  <View style={styles.tipHeader}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Tip type: ${ADVICE_LABELS[t.advice_type]}`}
                      onPress={() => setOpenTypeFor(openTypeFor === i ? null : i)}
                      style={styles.typeChip}
                    >
                      <Text style={styles.typeChipLabel}>{ADVICE_LABELS[t.advice_type]} ⌄</Text>
                    </Pressable>
                    {lowConfidence ? <Text style={styles.lowConf}>check this</Text> : <View />}
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Delete tip"
                      onPress={() => deleteTip(i)}
                      hitSlop={8}
                    >
                      <Text style={styles.deleteGlyph}>✕</Text>
                    </Pressable>
                  </View>

                  {openTypeFor === i ? (
                    <View style={styles.typePickerWrap}>
                      {ADVICE_ORDER.map((at) => (
                        <Pressable
                          key={at}
                          accessibilityRole="button"
                          accessibilityLabel={`Set type ${ADVICE_LABELS[at]}`}
                          onPress={() => setTipType(i, at)}
                          style={[styles.typeOption, t.advice_type === at && styles.typeOptionOn]}
                        >
                          <Text
                            style={[
                              styles.typeOptionLabel,
                              t.advice_type === at && styles.typeOptionLabelOn,
                            ]}
                          >
                            {ADVICE_LABELS[at]}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  ) : null}

                  <TextInput
                    accessibilityLabel="Tip text"
                    value={t.text}
                    onChangeText={(v) => updateTipText(i, v.slice(0, 500))}
                    multiline
                    style={styles.tipInput}
                    selectionColor={CORAL}
                    placeholder="The tip, in your words"
                    placeholderTextColor={FAINT}
                  />
                </View>
              );
            })}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add another tip"
              onPress={addBlankTip}
              style={styles.addTipGhost}
            >
              <Text style={styles.addTipGhostLabel}>+ Add another tip</Text>
            </Pressable>
          </View>
        )}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Save and share"
          onPress={onSave}
          disabled={createLog.isPending}
          style={[styles.cta, { marginTop: 24 }, createLog.isPending && { opacity: 0.5 }]}
        >
          {createLog.isPending ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.ctaLabel}>Save & share ✦</Text>
          )}
        </Pressable>
        <View style={{ height: 40 }} />
      </ScrollView>
    </Page>
  );
}

const styles = StyleSheet.create({
  headline: {
    fontFamily: 'PlayfairDisplay_500Medium',
    fontSize: 32,
    lineHeight: 36,
    color: INK,
    letterSpacing: -0.6,
    marginTop: 12,
  },
  sub: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    lineHeight: 20,
    color: MUTE,
    marginTop: 6,
  },
  field: { marginTop: 24 },
  input: {
    marginTop: 8,
    fontFamily: 'DMSans_400Regular',
    fontSize: 17,
    color: INK,
    borderBottomWidth: 1,
    borderBottomColor: HAIR,
    paddingVertical: 8,
  },
  noteCard: {
    marginTop: 8,
    backgroundColor: TINT,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: HAIR,
    padding: 14,
    minHeight: 110,
  },
  noteInput: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 16,
    lineHeight: 24,
    color: INK,
    minHeight: 84,
    textAlignVertical: 'top',
  },
  noteCardSmall: {
    marginTop: 8,
    backgroundColor: TINT,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: HAIR,
    padding: 14,
    minHeight: 64,
  },
  noteInputSmall: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    lineHeight: 22,
    color: INK,
    minHeight: 40,
    textAlignVertical: 'top',
  },
  example: {
    fontFamily: 'PlayfairDisplay_500Medium_Italic',
    fontSize: 13.5,
    lineHeight: 20,
    color: FAINT,
    marginTop: 10,
  },
  cta: {
    backgroundColor: INK,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 28,
  },
  ctaLabel: { fontFamily: 'DMSans_600SemiBold', fontSize: 16, color: '#FFFFFF' },

  backGlyph: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 14,
    color: MUTE,
    marginTop: 4,
    marginBottom: 4,
  },
  sourceCard: {
    marginTop: 16,
    backgroundColor: TINT,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: HAIR,
    padding: 14,
  },
  sourceText: {
    fontFamily: 'PlayfairDisplay_500Medium_Italic',
    fontSize: 16,
    lineHeight: 24,
    color: INK,
    marginTop: 6,
  },
  nudgeCard: {
    marginTop: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: HAIR,
    padding: 24,
    alignItems: 'center',
  },
  nudgeGlyph: { fontSize: 28, marginBottom: 10 },
  nudgeTitle: {
    fontFamily: 'PlayfairDisplay_500Medium',
    fontSize: 20,
    color: INK,
    marginBottom: 6,
    textAlign: 'center',
  },
  nudgeBody: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13.5,
    lineHeight: 20,
    color: MUTE,
    textAlign: 'center',
  },
  addTipBtn: {
    marginTop: 16,
    backgroundColor: CORAL,
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 22,
  },
  addTipLabel: { fontFamily: 'DMSans_600SemiBold', fontSize: 14, color: '#FFFFFF' },
  tipCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: HAIR,
    padding: 14,
  },
  tipHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  typeChip: {
    backgroundColor: TINT,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: HAIR,
  },
  typeChipLabel: { fontFamily: 'DMSans_600SemiBold', fontSize: 12, color: INK },
  lowConf: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 10,
    letterSpacing: 0.6,
    color: CORAL,
    textTransform: 'uppercase',
  },
  deleteGlyph: { fontSize: 15, color: FAINT },
  typePickerWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  typeOption: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: TINT,
    borderWidth: 1,
    borderColor: HAIR,
  },
  typeOptionOn: { backgroundColor: INK, borderColor: INK },
  typeOptionLabel: { fontFamily: 'DMSans_600SemiBold', fontSize: 12, color: MUTE },
  typeOptionLabelOn: { color: '#FFFFFF' },
  tipInput: {
    fontFamily: 'PlayfairDisplay_500Medium',
    fontSize: 16,
    lineHeight: 23,
    color: INK,
    marginTop: 10,
    textAlignVertical: 'top',
  },
  addTipGhost: {
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: HAIR,
    paddingVertical: 14,
    alignItems: 'center',
  },
  addTipGhostLabel: { fontFamily: 'DMSans_600SemiBold', fontSize: 14, color: CORAL },
});
