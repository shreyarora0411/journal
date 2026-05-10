import { Box, Button, Input, Text } from '@/components';
import { useUpdateProfile } from '@/features/auth';
import { useToast } from '@/hooks/use-toast';
import { log } from '@/lib/log';
import { DisplayNameSchema } from '@journal/shared';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export function FramingScreen() {
  const [name, setName] = useState('');
  const update = useUpdateProfile();
  const router = useRouter();
  const toast = useToast();

  useEffect(() => {
    log.event('onboarding.screen_entered', { screen: 'framing' });
  }, []);

  const onContinue = async () => {
    const parsed = DisplayNameSchema.safeParse(name);
    if (!parsed.success) {
      toast.show({
        message: parsed.error.issues[0]?.message ?? 'Tell us what to call you.',
        variant: 'error',
      });
      return;
    }
    try {
      await update.mutateAsync({ display_name: parsed.data });
      log.event('onboarding.screen_completed', { screen: 'framing' });
      router.replace('/(auth)/instagram');
    } catch (err) {
      log.error('framing update failed', err);
      toast.show({ message: 'Could not save. Try again.', variant: 'error' });
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FAF8F5' }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Box flex={1} padding="xl" justifyContent="center">
          <Text variant="title" marginBottom="m">
            Trips, in your voice
          </Text>
          <Text variant="body" color="textMuted" marginBottom="xl">
            Log where you went, how it felt, what you’d tell a friend. We turn that into a quietly
            useful guide for the people who already trust you.
          </Text>
          <Box gap="l">
            <Input
              label="Display name"
              placeholder="Shrey"
              value={name}
              onChangeText={setName}
              autoFocus
              autoCapitalize="words"
              maxLength={60}
            />
            <Button
              label={update.isPending ? 'Saving…' : 'Continue'}
              onPress={onContinue}
              loading={update.isPending}
              fullWidth
              size="lg"
            />
          </Box>
        </Box>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
