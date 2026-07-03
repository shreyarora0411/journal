import { log } from '@/lib/log';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/**
 * Welcome (#01 of the lore redesign — pilot variant).
 *
 * The "what the app actually is" preview. Three sample friend cards
 * stacked editorial-style, then a one-line headline + 60-second CTA.
 * Anonymous-auth means Sign-in and Get-started both land in /login —
 * we fire distinct analytics events to size returning-user intent.
 */

const INK = '#1A1410';
const MUTE = '#7A716A';
const HAIR = '#EFEAE2';
const PAPER = '#FFFFFF';
const CORAL = '#FF4D2E';

type SampleCard = {
  name: string;
  city: string;
  category: string;
  quote: string;
  avatarBg: string;
  avatarInitial: string;
};

const SAMPLE_CARDS: ReadonlyArray<SampleCard> = [
  {
    name: 'Arjun',
    city: 'TOKYO',
    category: 'FOOD',
    quote: '"The dutch pancake at Path Bakery is what I think about when I think about Tokyo."',
    avatarBg: '#D8C3A5',
    avatarInitial: 'A',
  },
  {
    name: 'Mira',
    city: 'TOKYO',
    category: 'STAY',
    quote: '"Stay in Yanaka. Old wooden lanes, no tourists past 6pm. Skip Shinjuku."',
    avatarBg: '#A8C3D4',
    avatarInitial: 'M',
  },
  {
    name: 'Tara',
    city: 'TOKYO',
    category: 'WANDER',
    quote: '"Walk the river from Kuramae to Asakusa at sunset. Trust me."',
    avatarBg: '#E2A29A',
    avatarInitial: 'T',
  },
];

export function WelcomeScreen() {
  const router = useRouter();

  useEffect(() => {
    log.event('onboarding.screen_entered', { screen: 'welcome' });
  }, []);

  const onStart = () => {
    log.event('onboarding.screen_completed', { screen: 'welcome', choice: 'begin' });
    router.push('/(auth)/login');
  };

  const onSignIn = () => {
    log.event('onboarding.screen_completed', { screen: 'welcome', choice: 'returning' });
    router.push('/(auth)/login');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Top bar: lore. + Sign in */}
      <View style={styles.topBar}>
        <Text accessibilityLabel="Vouch." style={styles.wordmark}>
          Vouch<Text style={{ color: CORAL }}>.</Text>
        </Text>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel="Sign in"
          onPress={onSignIn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.signInTop}>Sign in</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollBody} showsVerticalScrollIndicator={false}>
        {/* Stacked cards — three friend quotes, offset like a hand-fanned deck. */}
        <View testID="welcome-hero" accessibilityLabel="Sample friend quotes" style={styles.deck}>
          {SAMPLE_CARDS.map((c, idx) => (
            <View
              key={c.name}
              style={[
                styles.card,
                {
                  marginTop: idx === 0 ? 0 : -28,
                  marginLeft: idx === 1 ? 36 : idx === 2 ? -16 : 0,
                  transform: [{ rotate: idx === 0 ? '-2deg' : idx === 1 ? '1.5deg' : '-1deg' }],
                  zIndex: idx,
                },
              ]}
            >
              <View style={styles.cardHeader}>
                <View style={[styles.avatar, { backgroundColor: c.avatarBg }]}>
                  <Text style={styles.avatarInitial}>{c.avatarInitial}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardName}>{c.name}</Text>
                  <Text style={styles.cardMeta}>
                    ON {c.city} <Text style={styles.cardMetaDim}>·</Text> {c.category}
                  </Text>
                </View>
              </View>
              <Text style={styles.cardQuote}>{c.quote}</Text>
            </View>
          ))}
        </View>

        {/* Eyebrow */}
        <View style={styles.eyebrowRow}>
          <View style={styles.eyebrowDot} />
          <Text style={styles.eyebrowLabel}>THIS IS THE WHOLE APP</Text>
        </View>

        <Text style={styles.headline}>
          One honest line.{'\n'}From a friend{'\n'}who's actually been.
        </Text>

        <Text style={styles.sub}>
          Search any city → read what your people said. No reviews. No strangers. Drop in your own
          when you're back.
        </Text>
      </ScrollView>

      <View style={styles.ctaWrap}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Get started"
          onPress={onStart}
          style={styles.cta}
        >
          <Text style={styles.ctaLabel}>Get started — 60 seconds</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: PAPER },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingTop: 6,
    paddingBottom: 8,
  },
  wordmark: {
    fontFamily: 'PlayfairDisplay_500Medium',
    fontSize: 26,
    color: INK,
    letterSpacing: -0.6,
  },
  signInTop: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 14,
    color: INK,
  },
  scrollBody: {
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 24,
  },
  deck: {
    minHeight: 320,
    marginBottom: 36,
    paddingTop: 12,
  },
  card: {
    backgroundColor: PAPER,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: HAIR,
    paddingVertical: 16,
    paddingHorizontal: 18,
    // Soft shadow — stays subtle so the deck reads as paper, not glassy UI.
    shadowColor: '#000000',
    shadowOpacity: 0.06,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 15,
    color: PAPER,
  },
  cardName: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 15,
    color: INK,
  },
  cardMeta: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 10,
    letterSpacing: 1.2,
    color: MUTE,
    marginTop: 2,
  },
  cardMetaDim: { color: '#C8BFB5' },
  cardQuote: {
    fontFamily: 'PlayfairDisplay_500Medium',
    fontSize: 19,
    lineHeight: 26,
    color: INK,
    letterSpacing: -0.2,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  eyebrowDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: CORAL,
  },
  eyebrowLabel: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 11,
    letterSpacing: 1.4,
    color: CORAL,
  },
  headline: {
    fontFamily: 'PlayfairDisplay_500Medium',
    fontSize: 38,
    lineHeight: 42,
    color: INK,
    letterSpacing: -1,
  },
  sub: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    lineHeight: 22,
    color: MUTE,
    marginTop: 16,
  },
  ctaWrap: {
    paddingHorizontal: 22,
    paddingBottom: 12,
    paddingTop: 4,
    backgroundColor: PAPER,
  },
  cta: {
    backgroundColor: INK,
    borderRadius: 999,
    paddingVertical: 18,
    alignItems: 'center',
  },
  ctaLabel: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 15,
    color: PAPER,
  },
});
