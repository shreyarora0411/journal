import { Box, Button, Input, Text } from '@/components';
import { useStartSession } from '@/features/auth';
import { useToast } from '@/hooks/use-toast';
import { log } from '@/lib/log';
import { isLikelyValidPhone } from '@journal/shared';
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
      await start.mutateAsync({ phone });
      log.event('onboarding.screen_completed', { screen: 'phone' });
      // The auth state change pushes the user forward via AuthGate.
    } catch (err) {
      log.error('startSession failed', err);
      toast.show({ message: 'Could not start. Try again.', variant: 'error' });
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FAF8F5' }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Box flex={1} padding="xl" justifyContent="center">
          <Text variant="title" marginBottom="s">
            Your phone
          </Text>
          <Text variant="body" color="textMuted" marginBottom="xl">
            We use your number only to find friends already on Journal. We never call or text it.
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
