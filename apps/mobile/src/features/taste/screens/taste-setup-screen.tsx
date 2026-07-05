import { Page, PlacePicker, StatusSpace } from '@/components';
import { useUpdateProfile } from '@/features/auth';
import { useToast } from '@/hooks/use-toast';
import type { PlaceDetails } from '@/lib/google-places';
import { log } from '@/lib/log';
import { TASTE_AXES, type TasteAxes, type TasteAxis } from '@journal/shared';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLogPlace } from '../api/use-log-place';
import { useSavePriors } from '../api/use-save-priors';
import { useMyPlaces, useMyPriors } from '../api/use-taste-data';

const CORAL = '#FF4D2E';
const INK = '#1B1714';
const MUTE = '#8A8178';
const HAIR = '#E7E1D7';
const TINT = '#FAF6F0';

const SERIF = 'Fraunces_500';
const SANS = 'HankenGrotesk_400Regular';
const SANS_SEMI = 'HankenGrotesk_600SemiBold';
const SANS_BOLD = 'HankenGrotesk_700Bold';

// The 4 either/or taps (spec §3 onboarding). Each answer nudges ONE axis ±0.5
// — mild on purpose: priors fold in at weight 2 and real loves take over fast.
const QUESTIONS: { axis: TasteAxis; a: string; b: string; prompt: string }[] = [
  {
    axis: 'substance_scene',
    prompt: 'What makes the night?',
    a: 'The food/drink itself',
    b: 'The room, the crowd',
  },
  {
    axis: 'mellow_lively',
    prompt: 'Your default evening?',
    a: 'Quiet drinks, real talk',
    b: 'Loud, alive, out-out',
  },
  {
    axis: 'adventurous_trusty',
    prompt: 'New opening or old favourite?',
    a: 'Always the new place',
    b: 'The place I trust',
  },
  {
    axis: 'value_splurge',
    prompt: 'On spending?',
    a: 'Find the value gem',
    b: 'Splurge when it’s right',
  },
];

const GOAL = 5;

/**
 * Taste setup — the 2-minute onboarding (spec §3): 4 either/or taps (→ private
 * priors) then "pick 5 places that are SO you" (→ real loved reactions). A
 * brand-new user leaves with a live taste vector and 5 places on their map —
 * matchable honestly, nothing fabricated.
 */
export function TasteSetupScreen() {
  const router = useRouter();
  const toast = useToast();
  const savePriors = useSavePriors();
  const logPlace = useLogPlace();
  const updateProfile = useUpdateProfile();
  const priorsQ = useMyPriors();
  const placesQ = useMyPlaces();

  const [answers, setAnswers] = useState<Partial<TasteAxes>>({});
  const [phase, setPhase] = useState<'quiz' | 'places'>('quiz');
  const [picked, setPicked] = useState<PlaceDetails[]>([]);
  const [pickerKey, setPickerKey] = useState(0);
  const prefilled = useRef(false);

  useEffect(() => {
    log.event('taste.setup_entered');
  }, []);

  // Re-entry: a returning user's saved answers come back instead of a
  // blank quiz that would overwrite their priors with zeros.
  useEffect(() => {
    if (prefilled.current || !priorsQ.data) return;
    prefilled.current = true;
    const restored: Partial<TasteAxes> = {};
    TASTE_AXES.forEach((axis, i) => {
      const v = priorsQ.data?.[i];
      if (v !== undefined && v !== 0) restored[axis] = v;
    });
    setAnswers((prev) => (Object.keys(prev).length === 0 ? restored : prev));
  }, [priorsQ.data]);

  const existingLoves = (placesQ.data ?? []).filter((p) => p.sentiment === 'loved').length;

  const answered = QUESTIONS.filter((q) => answers[q.axis] !== undefined).length;

  const onAnswer = (axis: TasteAxis, value: number) =>
    setAnswers((prev) => ({ ...prev, [axis]: value }));

  const onQuizDone = async () => {
    try {
      await savePriors.mutateAsync(answers);
      setPhase('places');
    } catch {
      toast.show({ message: 'Could not save — try again.', variant: 'error' });
    }
  };

  const onPickPlace = async (place: PlaceDetails) => {
    if (picked.some((p) => p.google_place_id === place.google_place_id)) return;
    try {
      await logPlace.mutateAsync({ place, sentiment: 'loved' });
      setPicked((prev) => [...prev, place]);
      setPickerKey((k) => k + 1); // remount picker → clears the query
    } catch {
      toast.show({ message: 'Could not add that one — try again.', variant: 'error' });
    }
  };

  const onFinish = async () => {
    toast.show({
      message:
        picked.length > 0
          ? `Your taste is live — ${picked.length} love${picked.length === 1 ? '' : 's'} on the map.`
          : 'Your taste setup is in.',
      variant: 'success',
    });
    // Taste-setup is now the last gated step in the launch flow (circle/
    // contacts moved to a later re-entry point) — stamp completion here so
    // onboardingNextRoute() sends returning users straight to the map
    // instead of looping them back through the quiz. Never block the
    // navigate on this administrative write.
    try {
      await updateProfile.mutateAsync({ onboarding_completed: true });
    } catch (err) {
      log.warn('onboarding completion stamp failed', { error: String(err) });
    }
    router.replace('/(tabs)/book' as never);
  };

  // A returning user with loves already on the map may finish with 0 new
  // picks — the pick-5 is for the cold start, not a toll booth.
  const canFinish = picked.length > 0 || existingLoves > 0;

  return (
    <Page>
      <StatusSpace />
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Text style={styles.headline}>
          {phase === 'quiz' ? 'Two minutes of taste.' : 'Five places that are so you.'}
        </Text>
        <Text style={styles.sub}>
          {phase === 'quiz'
            ? 'Four quick calls — they seed your taste until your logs take over.'
            : 'The places you already know you love. They become your map — and how we learn whose picks will land for you.'}
        </Text>

        {phase === 'quiz' ? (
          <>
            {QUESTIONS.map((q) => {
              const v = answers[q.axis];
              return (
                <View key={q.axis} style={{ marginTop: 22 }}>
                  <Text style={styles.qPrompt}>{q.prompt}</Text>
                  <View style={styles.qRow}>
                    <Pressable
                      accessibilityRole="radio"
                      accessibilityLabel={q.a}
                      accessibilityState={{ selected: v === -0.5 }}
                      onPress={() => onAnswer(q.axis, -0.5)}
                      style={[styles.qBtn, v === -0.5 && styles.qBtnOn]}
                    >
                      <Text style={[styles.qLabel, v === -0.5 && { color: '#FFFFFF' }]}>{q.a}</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="radio"
                      accessibilityLabel={q.b}
                      accessibilityState={{ selected: v === 0.5 }}
                      onPress={() => onAnswer(q.axis, 0.5)}
                      style={[styles.qBtn, v === 0.5 && styles.qBtnOn]}
                    >
                      <Text style={[styles.qLabel, v === 0.5 && { color: '#FFFFFF' }]}>{q.b}</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Continue to picking places"
              onPress={onQuizDone}
              disabled={answered < QUESTIONS.length || savePriors.isPending}
              style={[styles.cta, answered < QUESTIONS.length && styles.ctaDisabled]}
            >
              <Text style={styles.ctaLabel}>
                {savePriors.isPending ? 'Saving…' : `Continue (${answered}/${QUESTIONS.length})`}
              </Text>
            </Pressable>
          </>
        ) : (
          <>
            <View style={{ marginTop: 20 }}>
              <PlacePicker
                key={pickerKey}
                mode="broad"
                placeholder="Search a place you love…"
                onPick={onPickPlace}
              />
            </View>

            {picked.length > 0 ? (
              <View style={{ marginTop: 16, gap: 8 }}>
                {picked.map((p) => (
                  <View key={p.google_place_id} style={styles.pickedRow}>
                    <Text style={styles.pickedName} numberOfLines={1}>
                      {p.name}
                    </Text>
                    <Text style={styles.pickedLoved}>Loved</Text>
                  </View>
                ))}
              </View>
            ) : null}

            <Text style={styles.counter}>
              {picked.length}/{GOAL} — {picked.length >= GOAL ? 'that’s a taste.' : 'keep going.'}
            </Text>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Finish taste setup"
              onPress={onFinish}
              disabled={!canFinish}
              style={[styles.cta, !canFinish && styles.ctaDisabled]}
            >
              <Text style={styles.ctaLabel}>
                {picked.length >= GOAL
                  ? 'Done — show my map'
                  : picked.length === 0 && existingLoves > 0
                    ? 'Done — back to my map'
                    : `Finish with ${picked.length}`}
              </Text>
            </Pressable>
          </>
        )}
        <View style={{ height: 60 }} />
      </ScrollView>
    </Page>
  );
}

const styles = StyleSheet.create({
  headline: { fontFamily: SERIF, fontSize: 28, color: INK, letterSpacing: -0.6, paddingTop: 8 },
  sub: { fontFamily: SANS, fontSize: 14, lineHeight: 21, color: MUTE, marginTop: 8 },
  qPrompt: { fontFamily: SANS_BOLD, fontSize: 13, color: INK, marginBottom: 10 },
  qRow: { flexDirection: 'row', gap: 8 },
  qBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: HAIR,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  qBtnOn: { backgroundColor: INK, borderColor: INK },
  qLabel: { fontFamily: SANS_SEMI, fontSize: 13, color: INK, textAlign: 'center' },
  cta: {
    marginTop: 28,
    backgroundColor: CORAL,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  ctaDisabled: { opacity: 0.4 },
  ctaLabel: { fontFamily: SANS_SEMI, fontSize: 15, color: '#FFFFFF' },
  pickedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    backgroundColor: TINT,
    borderWidth: 1,
    borderColor: HAIR,
  },
  pickedName: { fontFamily: SANS_SEMI, fontSize: 14, color: INK, flex: 1, marginRight: 10 },
  pickedLoved: { fontFamily: SANS_BOLD, fontSize: 11, color: CORAL, letterSpacing: 0.5 },
  counter: { fontFamily: SANS_SEMI, fontSize: 13, color: MUTE, marginTop: 16, textAlign: 'center' },
});
