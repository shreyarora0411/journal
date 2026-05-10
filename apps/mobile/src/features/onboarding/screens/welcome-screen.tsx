import { Box, Button, Text } from '@/components';
import { useUpdateProfile } from '@/features/auth';
import { useToast } from '@/hooks/use-toast';
import { log } from '@/lib/log';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

export function WelcomeScreen() {
  const update = useUpdateProfile();
  const router = useRouter();
  const toast = useToast();

  useEffect(() => {
    log.event('onboarding.screen_entered', { screen: 'welcome' });
  }, []);

  const onEnter = async () => {
    try {
      await update.mutateAsync({ onboarding_completed: true });
      log.event('onboarding.screen_completed', { screen: 'welcome' });
      log.event('onboarding.completed');
      router.replace('/(tabs)/feed');
    } catch (err) {
      log.error('welcome completion failed', err);
      toast.show({ message: 'Could not finish setup. Try again.', variant: 'error' });
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FAF8F5' }}>
      <Box flex={1} padding="xl" justifyContent="center">
        <Text variant="title" marginBottom="m">
          You’re in.
        </Text>
        <Text variant="quote" color="textMuted" marginBottom="xl">
          “The places you’ve loved, in your own words — quietly useful, only to the people who
          already trust you.”
        </Text>
        <Button
          label={update.isPending ? 'Finishing…' : 'Start journaling'}
          onPress={onEnter}
          loading={update.isPending}
          fullWidth
          size="lg"
        />
      </Box>
    </SafeAreaView>
  );
}
