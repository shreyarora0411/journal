import { Eyebrow, Page, StatusSpace } from '@/components';
import { useUpdateProfile } from '@/features/auth';
import { useMyTrips, useUpdateTrip } from '@/features/trips';
import { useToast } from '@/hooks/use-toast';
import { log } from '@/lib/log';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

const CORAL = '#FF4D2E';
const INK = '#1A1410';
const MUTE = '#7A716A';
const HAIR = '#EFEAE2';
const MAX_LEN = 220;

// Template chips shown at the bottom of the input — tap to insert prefix.
const TEMPLATES = ['Skip the…', 'Stay in the…', 'Go before…'] as const;

// Placeholder cover when a trip has no photo yet.
const FALLBACK_COVER =
  'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=1200&auto=format';

/**
 * Seed (#06 of the redesign — Batch A). Step 4 of 4.
 *
 * Walks the user through their newly-drafted trips, one at a time, asking
 * for a single sentence on each. We cap the walk at five trips even if
 * more were drafted in #05 — the rest go to the user's Book as photo-only
 * drafts, prompted later. When the walk completes we mark
 * `onboarding_completed_at` and route to `/(tabs)/book`.
 */
export function SeedScreen() {
  const router = useRouter();
  const toast = useToast();
  const profile = useUpdateProfile();
  const tripsQ = useMyTrips();
  const updateTrip = useUpdateTrip();

  const tripsToSeed = useMemo(() => (tripsQ.data ?? []).slice(0, 5), [tripsQ.data]);
  const [idx, setIdx] = useState(0);
  const [draft, setDraft] = useState('');

  const current = tripsToSeed[idx];
  const total = tripsToSeed.length;

  useEffect(() => {
    log.event('onboarding.screen_entered', { screen: 'seed' });
  }, []);

  const finish = async () => {
    try {
      await profile.mutateAsync({ onboarding_completed: true });
    } catch (err) {
      log.error('seed: mark completed failed', err);
    }
    log.event('onboarding.completed');
    router.replace('/(tabs)/book');
  };

  const persistDraft = async (): Promise<boolean> => {
    if (!current) return true;
    const note = draft.trim();
    if (note.length === 0) return true;
    try {
      await updateTrip.mutateAsync({
        id: current.id,
        patch: { note },
      });
      return true;
    } catch (err) {
      log.error('seed: update trip note failed', err);
      toast.show({ message: 'Could not save that note. Try again.', variant: 'error' });
      return false;
    }
  };

  const onNext = async () => {
    const ok = await persistDraft();
    if (!ok) return;
    if (idx + 1 >= total) return finish();
    setIdx(idx + 1);
    setDraft('');
  };

  const onSkip = async () => {
    if (idx + 1 >= total) return finish();
    setIdx(idx + 1);
    setDraft('');
  };

  // Edge cases — no drafts mean we just landed here cold; mark completed
  // and let the user enter the Book directly.
  if (tripsQ.isLoading) {
    return (
      <Page>
        <StatusSpace />
        <Text style={styles.sub}>Reading your book…</Text>
      </Page>
    );
  }

  if (total === 0) {
    // Auto-complete and bounce to /tabs/book — nothing to seed.
    finish();
    return null;
  }

  return (
    <Page>
      <StatusSpace />
      <View style={{ paddingTop: 8, gap: 12 }}>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <Eyebrow>Step 4 of 4</Eyebrow>
          <Text style={styles.sparkle}>·</Text>
          <Eyebrow color={MUTE}>{`${idx + 1} of ${total} trip${total === 1 ? '' : 's'}`}</Eyebrow>
        </View>

        <Text style={styles.headline}>
          One thing I'd tell{'\n'}a friend about{' '}
          <Text style={{ color: CORAL }}>{current?.title ?? 'this trip'}</Text>.
        </Text>
      </View>

      <View style={styles.cover}>
        <Image
          source={{ uri: FALLBACK_COVER }}
          style={{ width: '100%', height: 160 }}
          contentFit="cover"
          accessibilityIgnoresInvertColors
        />
        <View style={styles.coverOverlay}>
          <Text style={styles.coverDest}>{current?.title ?? ''}</Text>
          {current ? (
            <Text style={styles.coverDates}>
              {current.start_date} → {current.end_date}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.inputCard}>
        <TextInput
          accessibilityLabel="Your sentence"
          placeholder="e.g. Skip Tito's, lean into Assagao, sunset at Anjuna only."
          placeholderTextColor="#B7AEA5"
          value={draft}
          onChangeText={(v) => setDraft(v.slice(0, MAX_LEN))}
          multiline
          selectionColor={CORAL}
          style={styles.input}
        />
        <Text style={styles.counter}>
          {draft.length}/{MAX_LEN}
        </Text>
      </View>

      <View style={styles.templates}>
        {TEMPLATES.map((t) => (
          <Pressable
            key={t}
            accessibilityRole="button"
            onPress={() =>
              setDraft((cur) => (cur.length === 0 ? `${t} ` : `${cur} ${t.toLowerCase()} `))
            }
            style={styles.template}
          >
            <Text style={styles.templateLabel}>{t}</Text>
          </Pressable>
        ))}
      </View>

      <View style={{ flex: 1 }} />

      <View style={styles.progress}>
        {Array.from({ length: total }).map((_, i) => {
          const isCurrent = i === idx;
          return (
            <View
              // biome-ignore lint/suspicious/noArrayIndexKey: progress dots are positional
              key={i}
              style={[styles.dot, isCurrent ? styles.dotActive : styles.dotInactive]}
            />
          );
        })}
      </View>

      <View style={{ gap: 10 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Save and next"
          onPress={onNext}
          style={styles.cta}
        >
          <Text style={styles.ctaLabel}>
            {idx + 1 >= total ? 'Save & finish ✦' : 'Save & next'}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Skip this trip"
          onPress={onSkip}
          style={styles.skip}
        >
          <Text style={styles.skipLabel}>Skip this trip</Text>
        </Pressable>
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  sparkle: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 10,
    color: MUTE,
  },
  headline: {
    fontFamily: 'InstrumentSerif_400Italic',
    fontSize: 32,
    lineHeight: 36,
    color: INK,
    letterSpacing: -0.8,
    marginTop: 8,
  },
  cover: {
    marginTop: 20,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: HAIR,
  },
  coverOverlay: {
    position: 'absolute',
    left: 14,
    bottom: 14,
    right: 14,
  },
  coverDest: {
    fontFamily: 'InstrumentSerif_400Italic',
    fontSize: 26,
    color: '#FFFFFF',
    letterSpacing: -0.6,
  },
  coverDates: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 9,
    letterSpacing: 1.2,
    color: '#FFFFFF',
    opacity: 0.92,
    marginTop: 4,
  },
  inputCard: {
    marginTop: 20,
    borderColor: HAIR,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    backgroundColor: '#FFFFFF',
  },
  input: {
    minHeight: 96,
    fontFamily: 'InstrumentSerif_400Italic',
    fontSize: 20,
    lineHeight: 26,
    color: INK,
    textAlignVertical: 'top',
  },
  counter: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 9,
    letterSpacing: 1.2,
    color: MUTE,
    textAlign: 'right',
    marginTop: 8,
  },
  templates: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    marginTop: 12,
  },
  template: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: HAIR,
    backgroundColor: '#FFFFFF',
  },
  templateLabel: {
    fontFamily: 'Geist_400Regular',
    fontSize: 13,
    color: MUTE,
  },
  progress: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 16,
    marginBottom: 16,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  dotActive: {
    width: 24,
    backgroundColor: CORAL,
  },
  dotInactive: {
    width: 6,
    backgroundColor: HAIR,
  },
  cta: {
    backgroundColor: CORAL,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
  },
  ctaLabel: {
    fontFamily: 'Geist_500Medium',
    fontSize: 16,
    color: '#FFFFFF',
  },
  skip: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  skipLabel: {
    fontFamily: 'Geist_400Regular',
    fontSize: 13,
    color: MUTE,
  },
  sub: {
    fontFamily: 'Geist_400Regular',
    fontSize: 14,
    color: MUTE,
    marginTop: 24,
  },
});
