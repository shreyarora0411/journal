import { Box, Button, Input, Text } from '@/components';
import { useAuthStore, useStartSession } from '@/features/auth';
import { useToast } from '@/hooks/use-toast';
import { log } from '@/lib/log';
import { isLikelyValidPhone } from '@journal/shared';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/**
 * Pilot-only single-stage phone screen — no OTP. See ADR 0004.
 * Tapping Continue creates an anonymous session and stamps phone_hash.
 */
export function PhoneScreen() {
  const [phone, setPhone] = useState('');
  const start = useStartSession();
  const session = useAuthStore((s) => s.session);
  const router = useRouter();
  const toast = useToast();

  useEffect(() => {
    log.event('onboarding.screen_entered', { screen: 'phone' });
  }, []);

  const onContinue = async () => {
    Keyboard.dismiss();
    if (!isLikelyValidPhone(phone)) {
      toast.show({ message: 'Enter a valid international number.', variant: 'error' });
      return;
    }
    try {
      // Skip re-creating an anonymous user if we already have one (e.g. user
      // tapped Continue twice). Just stamp the new phone hash and move on.
      if (!session) {
        await start.mutateAsync({ phone });
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
        <Box flex={1} padding="xl" justifyContent="center">
          <Text variant="title" marginBottom="s">
            Your phone
          </Text>
          <Text variant="body" color="textMuted" marginBottom="xl">
            We use your number only to find friends already on Postmark. We never call or text it.
          </Text>
          <Box gap="l">
            <Input
              label="Phone"
              placeholder="+91 98 7654 3210"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              autoComplete="tel"
              autoFocus
            />
            <Button
              label={start.isPending ? 'Starting…' : 'Continue'}
              onPress={onContinue}
              loading={start.isPending}
              fullWidth
              size="lg"
            />
          </Box>
        </Box>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
