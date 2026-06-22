import { Eyebrow, Page, StatusSpace, VerdictPicker, type Verdict } from '@/components';
import { useToast } from '@/hooks/use-toast';
import { log } from '@/lib/log';
import {
  VOUCH_CATEGORIES,
  type VouchInput,
  type VouchType,
  looksSpecific,
} from '@journal/shared';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useCreateVouchedTrip } from '../index';

const CORAL = '#FF4D2E';
const INK = '#1A1410';
const MUTE = '#7A716A';
const FAINT = '#B7AE9F';
const HAIR = '#EFEAE2';
const TINT = '#FAF6F0';

// One faded real seed vouch, register-setting (v3 §4B).
const EXAMPLE = 'Banjara in Kaza, book the tents not the rooms.';

/**
 * Vouch a trip (Vouched v3, Loop A) — the single most important screen.
 *
 * Verdict-first, then 5 atomic, category-slotted asks. Each answer the user
 * writes becomes one Vouch directly, typed by its slot — no prose blob, no
 * extraction, no review step. The category is the format-constraint that
 * forces specificity; it never constrains how the user phrases the answer.
 *
 * Every ask is optional and skippable. A user with only a hotel rec gives the
 * hotel and saves. The progress chip counts vouches BANKED, not fields
 * completed — it rewards contribution, never demands completion.
 */
export function TripComposerScreen() {
  const router = useRouter();
  const toast = useToast();
  const createTrip = useCreateVouchedTrip();

  const [destination, setDestination] = useState('');
  const [verdict, setVerdict] = useState<Verdict>('love');
  // One free-text answer per category slot, keyed by vouch_type.
  const [answers, setAnswers] = useState<Record<VouchType, string>>({
    stay: '',
    eat_drink: '',
    do: '',
    good_to_know: '',
    skip: '',
  });

  useEffect(() => {
    log.event('composer.screen_entered');
  }, []);

  const vouches: VouchInput[] = useMemo(
    () =>
      VOUCH_CATEGORIES.map((c) => ({ vouch_type: c.type, text: answers[c.type].trim() })).filter(
        (v) => v.text.length > 0,
      ),
    [answers],
  );
  const bankedCount = vouches.length;
  const canSave = destination.trim().length > 0 && bankedCount > 0;

  const onSave = async () => {
    if (!canSave) {
      toast.show({
        message:
          destination.trim().length === 0
            ? 'Where did you go?'
            : 'Add at least one vouch — a place, dish, or thing to do.',
        variant: 'error',
      });
      return;
    }
    try {
      const res = await createTrip.mutateAsync({
        destination_text: destination.trim(),
        verdict,
        visibility: 'friends_of_friends',
        vouches,
      });
      toast.show({
        message: `Saved — ${res.vouchCount} vouch${res.vouchCount === 1 ? '' : 'es'} live for your circle.`,
        variant: 'success',
      });
      router.replace('/(tabs)/book');
    } catch (err) {
      log.error('createVouchedTrip failed', err);
      toast.show({ message: 'Could not save. Try again.', variant: 'error' });
    }
  };

  return (
    <Page>
      <StatusSpace />
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.headerRow}>
          <Text style={styles.headline}>Vouch a trip.</Text>
          {bankedCount > 0 ? (
            <View style={styles.bankChip}>
              <Text style={styles.bankChipLabel}>
                {bankedCount} vouch{bankedCount === 1 ? '' : 'es'}
              </Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.sub}>Like texting a friend who's about to go. Skip anything.</Text>

        {/* Step 1 — the frame */}
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

        {/* Faded register-setting example */}
        <Text style={styles.example}>e.g. “{EXAMPLE}”</Text>

        {/* Step 2 — the atomic, category-slotted asks */}
        {VOUCH_CATEGORIES.map((c) => {
          const value = answers[c.type];
          const nudge = value.trim().length > 0 && !looksSpecific(value);
          return (
            <View key={c.type} style={styles.field}>
              <Eyebrow color={MUTE}>{c.hint ? `${c.prompt}  ·  ${c.hint}` : c.prompt}</Eyebrow>
              <View style={styles.voiceCard}>
                <TextInput
                  accessibilityLabel={c.prompt}
                  placeholder={c.placeholder}
                  placeholderTextColor={FAINT}
                  value={value}
                  onChangeText={(v) => setAnswers((prev) => ({ ...prev, [c.type]: v.slice(0, 500) }))}
                  multiline
                  style={styles.voiceInput}
                  selectionColor={CORAL}
                />
              </View>
              {nudge ? (
                <Text style={styles.nudge}>One place, dish, or specific thing?</Text>
              ) : null}
            </View>
          );
        })}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Save and share"
          onPress={onSave}
          disabled={!canSave || createTrip.isPending}
          style={[styles.cta, (!canSave || createTrip.isPending) && { opacity: 0.5 }]}
        >
          {createTrip.isPending ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.ctaLabel}>Save & share ✦</Text>
          )}
        </Pressable>
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
  sub: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    lineHeight: 20,
    color: MUTE,
    marginTop: 6,
  },
  field: { marginTop: 22 },
  input: {
    marginTop: 8,
    fontFamily: 'DMSans_400Regular',
    fontSize: 17,
    color: INK,
    borderBottomWidth: 1,
    borderBottomColor: HAIR,
    paddingVertical: 8,
  },
  example: {
    fontFamily: 'PlayfairDisplay_500Medium_Italic',
    fontSize: 13.5,
    lineHeight: 20,
    color: FAINT,
    marginTop: 18,
  },
  voiceCard: {
    marginTop: 8,
    backgroundColor: TINT,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: HAIR,
    padding: 12,
    minHeight: 56,
  },
  voiceInput: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 15.5,
    lineHeight: 22,
    color: INK,
    minHeight: 32,
    textAlignVertical: 'top',
  },
  nudge: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    color: CORAL,
    marginTop: 6,
  },
  cta: {
    backgroundColor: INK,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 28,
  },
  ctaLabel: { fontFamily: 'DMSans_600SemiBold', fontSize: 16, color: '#FFFFFF' },
});
