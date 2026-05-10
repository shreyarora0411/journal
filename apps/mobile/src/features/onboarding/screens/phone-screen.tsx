import { Box, Button, Input, Text } from '@/components';
import { useSignInWithPhone, useVerifyOtp } from '@/features/auth';
import { useToast } from '@/hooks/use-toast';
import { log } from '@/lib/log';
import { isLikelyValidPhone, normalizePhone } from '@journal/shared';
import { useEffect, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Stage = 'phone' | 'code';

export function PhoneScreen() {
  const [stage, setStage] = useState<Stage>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const sendOtp = useSignInWithPhone();
  const verify = useVerifyOtp();
  const toast = useToast();

  useEffect(() => {
    log.event('onboarding.screen_entered', { screen: 'phone' });
  }, []);

  const onSendOtp = async () => {
    Keyboard.dismiss();
    if (!isLikelyValidPhone(phone)) {
      toast.show({ message: 'Enter a valid international number.', variant: 'error' });
      return;
    }
    try {
      await sendOtp.mutateAsync({ phone });
      setStage('code');
      log.event('onboarding.screen_completed', { screen: 'phone', step: 'send' });
    } catch (err) {
      log.error('signInWithPhone failed', err);
      toast.show({ message: 'Could not send the code. Try again.', variant: 'error' });
    }
  };

  const onVerify = async () => {
    Keyboard.dismiss();
    try {
      await verify.mutateAsync({ phone, code });
      log.event('onboarding.screen_completed', { screen: 'phone', step: 'verify' });
      // Auth state change pushes the user forward.
    } catch (err) {
      log.error('verifyOtp failed', err);
      toast.show({ message: 'That code didn’t work.', variant: 'error' });
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
            {stage === 'phone' ? 'Your phone' : 'Enter the code'}
          </Text>
          <Text variant="body" color="textMuted" marginBottom="xl">
            {stage === 'phone'
              ? 'We’ll send a one-time code over WhatsApp.'
              : `Sent to ${normalizePhone(phone)}.`}
          </Text>

          {stage === 'phone' ? (
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
                label={sendOtp.isPending ? 'Sending…' : 'Send code'}
                onPress={onSendOtp}
                loading={sendOtp.isPending}
                fullWidth
                size="lg"
              />
            </Box>
          ) : (
            <Box gap="l">
              <Input
                label="Code"
                placeholder="123456"
                value={code}
                onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
                keyboardType="number-pad"
                autoFocus
                maxLength={6}
              />
              <Button
                label={verify.isPending ? 'Verifying…' : 'Continue'}
                onPress={onVerify}
                loading={verify.isPending}
                fullWidth
                size="lg"
              />
              <Button
                label="Use a different number"
                variant="ghost"
                onPress={() => setStage('phone')}
              />
            </Box>
          )}
        </Box>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
