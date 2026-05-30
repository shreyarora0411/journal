import { fetchSelf } from '@/features/auth/api/use-profile';
import { useAuthStore, useStartSession } from '@/features/auth';
import { useToast } from '@/hooks/use-toast';
import { getSupabase } from '@/lib/supabase';
import { log } from '@/lib/log';
import { isLikelyValidPhone } from '@journal/shared';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const COUNTRY_CODE = '+91';
const CORAL = '#FF4D2E';
const INK = '#1A1410';
const MUTE = '#7A716A';
const HAIR = '#EFEAE2';
const EMERALD = '#00A67E';

/**
 * Login (#02 — Batch A). Phone-first with an OTP visual hint, then the
 * camera-roll fast-path, then the emerald privacy line.
 *
 * Anonymous-auth visual treatment per ADR 0004: tapping Continue calls
 * `useStartSession({ phone })` which signs in anonymously and stores the
 * hashed phone. No real OTP round-trip happens — the "we just sent a code"
 * hint is visual only, kept to make the funnel feel familiar.
 *
 * Brief deviation flag: the brief specifies a pink Instagram fast-path
 * button. Rule 4 ("One accent at a time. Coral is the primary accent.
 * Pink ... never used as button colors.") wins — the fast-path uses coral
 * with an explicit camera-roll glyph to differentiate it visually from the
 * primary CTA. Per ADR 0005 Instagram OAuth is deferred; the fast-path
 * actually routes to the camera-roll loader.
 */
export function LoginScreen() {
  const [rawDigits, setRawDigits] = useState('');
  const start = useStartSession();
  const session = useAuthStore((s) => s.session);
  const router = useRouter();
  const toast = useToast();

  useEffect(() => {
    log.event('onboarding.screen_entered', { screen: 'login' });
  }, []);

  const e164 = `${COUNTRY_CODE}${rawDigits}`;

  const onContinue = async () => {
    Keyboard.dismiss();
    if (rawDigits.length < 10 || !isLikelyValidPhone(e164)) {
      toast.show({ message: 'Enter a valid 10-digit number.', variant: 'error' });
      return;
    }
    try {
      // If a stale session is hanging around (e.g. a half-onboarded anon
      // user from a previous attempt), wipe it BEFORE invoking recovery
      // — otherwise useStartSession short-circuits on `!session` and the
      // phone-keyed recover-session path never gets a chance to fire.
      if (session) {
        await getSupabase().auth.signOut();
      }
      await start.mutateAsync({ phone: e164 });
      log.event('onboarding.screen_completed', { screen: 'login', choice: 'phone' });

      // After sign-in: read the profile directly off the freshly-set
      // supabase session (not via Zustand — onAuthStateChange may not
      // have fired yet, leaving the store stale). Then route ourselves
      // explicitly instead of waiting for the AuthGate.
      const supabase = getSupabase();
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id ?? null;
      if (!userId) {
        toast.show({ message: 'Sign in succeeded but no user — try again.', variant: 'error' });
        return;
      }
      const profile = await fetchSelf(userId);
      if (profile?.onboarding_completed_at) {
        router.replace('/(tabs)/book');
      } else if (profile?.display_name) {
        router.replace('/(auth)/circle');
      } else {
        router.replace('/(auth)/framing');
      }
    } catch (err) {
      log.error('startSession failed', err);
      toast.show({ message: 'Could not start. Try again.', variant: 'error' });
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.body}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back"
              onPress={() => router.back()}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={{ alignSelf: 'flex-start', marginBottom: 8 }}
            >
              <Text style={styles.backGlyph}>‹</Text>
            </Pressable>

            <Text accessibilityLabel="lore." style={styles.wordmark}>
              lore<Text style={{ color: CORAL }}>.</Text>
            </Text>

            <Text style={styles.headline}>
              Sign in with the number{'\n'}your friends already have.
            </Text>
            <Text style={styles.sub}>
              We'll text you a one-time code. Used only to match you with people you actually know.
            </Text>

            {/* Phone row — country pill + 10-digit input. */}
            <View style={styles.phoneRow}>
              <View style={styles.countryPill}>
                <Text style={styles.countryFlag}>🇮🇳</Text>
                <Text style={styles.countryCode}>+91</Text>
              </View>
              <View style={styles.divider} />
              <TextInput
                selectionColor={CORAL}
                textContentType="telephoneNumber"
                autoComplete="tel"
                style={styles.input}
                placeholder="98765 43210"
                placeholderTextColor="#9A9A9A"
                value={rawDigits}
                onChangeText={(v) => setRawDigits(v.replace(/\D/g, '').slice(0, 10))}
                keyboardType="phone-pad"
                maxLength={10}
                accessibilityLabel="Phone number"
              />
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Send me a code"
              onPress={onContinue}
              style={styles.cta}
              disabled={start.isPending}
            >
              <Text style={styles.ctaLabel}>
                {start.isPending ? 'Starting…' : 'Send me a code'}
              </Text>
            </Pressable>

            {/* Camera-roll fast-path removed in pilot-fixes session —
                phone-number is the only sign-in path. The Instagram
                preview lives on Circle for now (Coming soon). */}

            <View style={{ flex: 1 }} />

            {/* Privacy line — emerald check + reassurance copy */}
            <View style={styles.privacyRow}>
              <View style={styles.privacyCheck}>
                <Text style={styles.privacyCheckGlyph}>✓</Text>
              </View>
              <Text style={styles.privacyText}>
                Only your circle sees you. <Text style={{ color: INK }}>Promise.</Text>
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    paddingHorizontal: 22,
    paddingTop: 12,
    gap: 16,
  },
  backGlyph: {
    fontFamily: 'InstrumentSerif_400Italic',
    fontSize: 26,
    lineHeight: 26,
    color: INK,
  },
  wordmark: {
    fontFamily: 'InstrumentSerif_400Italic',
    fontSize: 26,
    color: INK,
    letterSpacing: -0.6,
    marginBottom: 24,
  },
  headline: {
    fontFamily: 'InstrumentSerif_400Italic',
    fontSize: 32,
    lineHeight: 36,
    color: INK,
    letterSpacing: -0.8,
  },
  sub: {
    fontFamily: 'Geist_400Regular',
    fontSize: 14,
    lineHeight: 22,
    color: MUTE,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 8,
    borderWidth: 1,
    borderColor: INK,
    marginTop: 8,
  },
  countryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  countryFlag: { fontSize: 18 },
  countryCode: {
    fontFamily: 'Geist_500Medium',
    fontSize: 16,
    color: INK,
  },
  divider: { width: 1, height: 22, backgroundColor: HAIR },
  input: {
    flex: 1,
    fontFamily: 'Geist_400Regular',
    fontSize: 16,
    color: INK,
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  cta: {
    backgroundColor: INK,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
  },
  ctaLabel: {
    fontFamily: 'Geist_500Medium',
    fontSize: 16,
    color: '#FFFFFF',
  },
  privacyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    marginTop: 8,
  },
  privacyCheck: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: EMERALD,
    alignItems: 'center',
    justifyContent: 'center',
  },
  privacyCheckGlyph: {
    color: '#FFFFFF',
    fontFamily: 'Geist_500Medium',
    fontSize: 10,
    lineHeight: 10,
  },
  privacyText: {
    fontFamily: 'Geist_400Regular',
    fontSize: 13,
    color: MUTE,
  },
});
