import { log } from '@/lib/log';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Welcome (#01 of the lore redesign — Batch A). The entry hero, replacing
 * the old "Cover" screen.
 *
 * Layout per the brief:
 *   - Full-bleed photo, 62% of viewport
 *   - `lore.` wordmark centered over the hero, white italic Instrument Serif
 *     with the coral dot as a deliberate brand mark (not punctuation)
 *   - Cream-paper bottom half with the editorial headline (44px italic serif),
 *     sub-copy, ink "Get started" CTA, and a text "Sign in" link
 *
 * Both CTAs route into the Login screen — anonymous-auth means there's no
 * distinct sign-in surface (ADR 0004). The Sign-in tap fires a separate
 * analytics event so we can size returning-user intent later.
 */
const HERO_URI = 'https://images.unsplash.com/photo-1545569341-9eb8b30979d9?w=1200&auto=format';

export function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const screenH = Dimensions.get('window').height;
  // Hero is 62% of viewport per brief. Pin in CSS so it doesn't fight the
  // flex on tall vs short phones.
  const heroH = Math.round(screenH * 0.62);

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
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <View style={[styles.hero, { height: heroH }]}>
        <Image
          source={{ uri: HERO_URI }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          accessibilityIgnoresInvertColors
          testID="welcome-hero"
        />
        {/* Wordmark overlay — italic serif `lore` + coral dot. The dot is a
            separate Text node so it can sit at full coral regardless of the
            outer `color` prop on `lore`. */}
        <View style={[styles.wordmarkRow, { top: insets.top + 28 }]}>
          <Text
            accessibilityLabel="lore."
            style={{
              fontFamily: 'InstrumentSerif_400Italic',
              fontSize: 28,
              color: '#FFFFFF',
              letterSpacing: -0.6,
            }}
          >
            lore
            <Text style={{ color: '#FF4D2E' }}>.</Text>
          </Text>
        </View>
      </View>

      <SafeAreaView edges={['bottom']} style={{ flex: 1 }}>
        <View style={styles.body}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <View style={styles.eyebrowDot} />
            <Text style={styles.eyebrowLabel}>JUST MY CIRCLE. NO ONE ELSE.</Text>
          </View>

          <Text style={styles.headline}>
            A travel book{'\n'}my friends{'\n'}write with me.
          </Text>
          <Text style={styles.sub}>
            No more WhatsApp scavenger hunts.{'\n'}
            Search a place. See what my people actually said.
          </Text>

          <View style={{ flex: 1 }} />

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Get started"
            onPress={onStart}
            style={styles.cta}
          >
            <Text style={styles.ctaLabel}>Get started</Text>
          </Pressable>

          <View style={styles.signInRow}>
            <Text style={styles.signInPrefix}>Already have an account? </Text>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel="Sign in"
              onPress={onSignIn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.signInLink}>Sign in</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    width: '100%',
    backgroundColor: '#1A1410',
    overflow: 'hidden',
  },
  wordmarkRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  body: {
    flex: 1,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 28,
  },
  eyebrowDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FF4D2E',
  },
  eyebrowLabel: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 10,
    lineHeight: 10,
    letterSpacing: 1.4,
    color: '#FF4D2E',
  },
  headline: {
    fontFamily: 'InstrumentSerif_400Italic',
    fontSize: 44,
    lineHeight: 46,
    color: '#1A1410',
    letterSpacing: -1.2,
  },
  sub: {
    fontFamily: 'Geist_400Regular',
    fontSize: 14,
    lineHeight: 22,
    color: '#7A716A',
    marginTop: 16,
  },
  cta: {
    backgroundColor: '#1A1410',
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
  },
  ctaLabel: {
    fontFamily: 'Geist_500Medium',
    fontSize: 16,
    color: '#FFFFFF',
  },
  signInRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
  },
  signInPrefix: {
    fontFamily: 'Geist_400Regular',
    fontSize: 13,
    color: '#7A716A',
  },
  signInLink: {
    fontFamily: 'Geist_500Medium',
    fontSize: 13,
    color: '#FF4D2E',
  },
});
