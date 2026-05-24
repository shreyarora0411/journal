import { useAuthStore, useStartSession } from '@/features/auth';
import { useToast } from '@/hooks/use-toast';
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
import { AltImportCard } from '../components/AltImportCard';
import { CountryPill } from '../components/CountryPill';
import { OnboardingStepHeader } from '../components/OnboardingStepHeader';

const COUNTRY_CODE = '+91';

/**
 * Sign up (#02 in the lore. design pack). Step 1 of 4. Pilot uses anonymous
 * auth — Continue starts an anonymous session and stores the phone hash;
 * there's no SMS round-trip. The camera-roll card is the alt path for users
 * who'd rather seed their book from photos.
 */
export function PhoneScreen() {
  const [rawDigits, setRawDigits] = useState('');
  const start = useStartSession();
  const session = useAuthStore((s) => s.session);
  const router = useRouter();
  const toast = useToast();

  useEffect(() => {
    log.event('onboarding.screen_entered', { screen: 'phone' });
  }, []);

  const e164 = `${COUNTRY_CODE}${rawDigits}`;

  const onContinue = async () => {
    Keyboard.dismiss();
    if (rawDigits.length < 10 || !isLikelyValidPhone(e164)) {
      toast.show({ message: 'Enter a valid 10-digit number.', variant: 'error' });
      return;
    }
    try {
      if (!session) {
        await start.mutateAsync({ phone: e164 });
      }
      log.event('onboarding.screen_completed', { screen: 'phone' });
      router.replace('/(auth)/framing');
    } catch (err) {
      log.error('startSession failed', err);
      toast.show({ message: 'Could not start. Try again.', variant: 'error' });
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          <OnboardingStepHeader step={1} total={4} showWordmark />

          <View style={styles.body}>
            <Text style={styles.headline}>
              Sign in with the number{'\n'}your friends already have.
            </Text>
            <Text style={styles.sub}>
              We use your number to match you with people you actually know.{'\n'}
              Never shown, never sold.
            </Text>

            <View style={styles.phoneRow}>
              <CountryPill />
              <View style={styles.divider} />
              <TextInput
                style={styles.input}
                placeholder="98765 43210"
                placeholderTextColor="#9A9A9A"
                value={rawDigits}
                onChangeText={(v) => setRawDigits(v.replace(/\D/g, '').slice(0, 10))}
                keyboardType="phone-pad"
                autoComplete="tel"
                maxLength={10}
              />
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={onContinue}
              style={styles.cta}
              disabled={start.isPending}
            >
              <Text style={styles.ctaLabel}>{start.isPending ? 'Starting…' : 'Continue'}</Text>
            </Pressable>

            <View style={styles.orRow}>
              <View style={styles.orLine} />
              <Text style={styles.orLabel}>OR FASTER</Text>
              <View style={styles.orLine} />
            </View>

            <AltImportCard onPress={() => router.push('/(auth)/import')} />

            <View style={styles.fineprint}>
              <Text style={styles.fineprintText}>
                By continuing, you agree to our{' '}
                <Text style={styles.fineprintLink} onPress={() => router.push('/house-rules')}>
                  house rules
                </Text>
                .
              </Text>
              <Text style={[styles.fineprintText, { marginTop: 4 }]}>
                lore is a quieter place. Be kind, recommend honestly.
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 24, paddingTop: 24, gap: 20 },
  headline: {
    fontFamily: 'Fraunces_400Italic',
    fontSize: 32,
    lineHeight: 40,
    color: '#1A1A1A',
    letterSpacing: -0.3,
  },
  sub: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 22,
    color: '#5A5A5A',
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  divider: { width: 1, height: 22, backgroundColor: 'rgba(0,0,0,0.1)' },
  input: {
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    color: '#1A1A1A',
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  cta: {
    backgroundColor: '#1A1A1A',
    borderRadius: 28,
    paddingVertical: 18,
    alignItems: 'center',
  },
  ctaLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 16,
    color: '#FFFFFF',
  },
  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
  },
  orLine: { flex: 1, height: 1, backgroundColor: '#EFEAE2' },
  orLabel: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 10,
    // lineHeight === fontSize so the text bounding box has no descender
    // padding; alignItems: 'center' then truly centres the lines through
    // the glyph optical mid-line.
    lineHeight: 10,
    letterSpacing: 1.4,
    color: '#7A716A',
  },
  fineprint: { marginTop: 8 },
  fineprintText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    lineHeight: 18,
    color: '#7A7A7A',
    textAlign: 'center',
  },
  fineprintLink: {
    color: '#FF4D2E',
    fontFamily: 'Inter_500Medium',
  },
});
