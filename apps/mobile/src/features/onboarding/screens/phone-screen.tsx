import { Box, Button, Text } from '@/components';
import { useAuthStore, useStartSession } from '@/features/auth';
import { useToast } from '@/hooks/use-toast';
import { log } from '@/lib/log';
import { isLikelyValidPhone } from '@journal/shared';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StepIndicator } from '../components/StepIndicator';

const COUNTRY_CODE = '+91';

/**
 * Sign up (#04 in the design pack). Pilot uses anonymous auth so there's no
 * OTP round-trip — we still keep the design's chrome (step indicator,
 * country prefix, fineprint). Copy adapted to be honest about what the app
 * actually does ("we use this only to find friends" — not "we'll text you").
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
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FAF8F3' }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Box flex={1} padding="l">
          <StepIndicator step={1} total={4} />

          <Box marginTop="l">
            <Text variant="display" style={{ fontSize: 36, lineHeight: 42 }}>
              {"What's your\nnumber?"}
            </Text>
            <Text variant="caption" marginTop="m" style={{ fontSize: 14, lineHeight: 22 }}>
              We use this only to find friends already on Postmark. No password to remember.
            </Text>
          </Box>

          <Box marginTop="xl">
            <Text variant="label" marginBottom="s">
              PHONE NUMBER
            </Text>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                borderWidth: 1,
                borderColor: 'rgba(0,0,0,0.15)',
                borderRadius: 12,
                paddingHorizontal: 12,
                paddingVertical: 12,
                gap: 12,
                backgroundColor: '#FFFFFF',
              }}
            >
              <Text style={{ fontFamily: 'Inter_500Medium', color: '#5A5A5A', fontSize: 16 }}>
                {COUNTRY_CODE}
              </Text>
              <View style={{ width: 1, height: 20, backgroundColor: 'rgba(0,0,0,0.08)' }} />
              <TextInput
                style={{
                  flex: 1,
                  fontFamily: 'Inter_400Regular',
                  fontSize: 16,
                  color: '#1A1A1A',
                  paddingVertical: 2,
                }}
                placeholder="98765 43210"
                placeholderTextColor="#9A9A9A"
                value={rawDigits}
                onChangeText={(v) => setRawDigits(v.replace(/\D/g, '').slice(0, 10))}
                keyboardType="phone-pad"
                autoComplete="tel"
                autoFocus
                maxLength={10}
              />
            </View>
          </Box>

          <View style={{ flex: 1 }} />

          <Button
            label={start.isPending ? 'Starting…' : 'Continue'}
            onPress={onContinue}
            loading={start.isPending}
            fullWidth
            size="lg"
          />
          <Text variant="meta" textAlign="center" marginTop="m">
            By continuing, you agree to our Terms and Privacy. Only friends you invite see your
            book.
          </Text>
        </Box>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
