import { Box, Button, Text } from '@/components';
import { useUpdateProfile } from '@/features/auth';
import { useToast } from '@/hooks/use-toast';
import { log } from '@/lib/log';
import { DisplayNameSchema } from '@journal/shared';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { OnboardingStepHeader } from '../components/OnboardingStepHeader';

/**
 * Pilot onboarding step 1 of 2 — name only.
 *
 * Per the trimmed pilot flow: Welcome → Login → **Name** → Circle →
 * Feed. Home city, bio, and avatar are deliberately deferred to a
 * future "edit your profile" surface — every extra field bleeds the
 * funnel. The pilot needs the friend graph more than it needs a
 * polished profile.
 */
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
      router.replace('/(auth)/circle');
    } catch (err) {
      const reason =
        err && typeof err === 'object' && 'message' in err && typeof err.message === 'string'
          ? err.message
          : String(err);
      log.error('framing update failed', { error: reason });
      toast.show({ message: `Could not save: ${reason}`, variant: 'error' });
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Box flex={1} padding="l">
          <OnboardingStepHeader step={1} total={2} showBack />

          <Box marginTop="l">
            <Text variant="display" style={{ fontSize: 36, lineHeight: 42 }}>
              {'What should\nfriends call you?'}
            </Text>
            <Text variant="caption" marginTop="m" style={{ fontSize: 14, lineHeight: 22 }}>
              This is how you'll show up when your notes appear in search.
            </Text>
          </Box>

          <Box marginTop="xl">
            <Text variant="label" marginBottom="s">
              YOUR NAME
            </Text>
            <View
              style={{
                borderWidth: 1,
                borderColor: '#1A1410',
                borderRadius: 14,
                paddingHorizontal: 12,
                paddingVertical: 12,
                backgroundColor: '#FFFFFF',
              }}
            >
              <TextInput
                selectionColor="#FF4D2E"
                textContentType="name"
                autoComplete="name"
                style={{
                  fontFamily: 'Geist_400Regular',
                  fontSize: 16,
                  color: '#1A1410',
                  paddingVertical: 2,
                }}
                placeholder="Shrey Arora"
                placeholderTextColor="#9A9A9A"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                autoFocus
                maxLength={60}
                onSubmitEditing={onContinue}
                returnKeyType="next"
              />
            </View>
          </Box>

          <Box flex={1} />

          <Button
            label={update.isPending ? 'Saving…' : 'Continue'}
            onPress={onContinue}
            loading={update.isPending}
            fullWidth
            size="lg"
          />
        </Box>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
