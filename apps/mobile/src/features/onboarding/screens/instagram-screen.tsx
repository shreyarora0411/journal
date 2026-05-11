import { Box, Button, Text } from '@/components';
import { log } from '@/lib/log';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

/**
 * Phase 1 surface only. The actual Instagram OAuth + import lands in Phase 4.4.
 * For now, both buttons advance the flow; the "Connect" button just notes the
 * intent in analytics so we can size the feature later.
 */
export function InstagramScreen() {
  const router = useRouter();

  useEffect(() => {
    log.event('onboarding.screen_entered', { screen: 'instagram' });
  }, []);

  const onConnect = () => {
    log.event('onboarding.screen_completed', { screen: 'instagram', choice: 'connect' });
    router.replace('/(auth)/import');
  };

  const onSkip = () => {
    log.event('onboarding.screen_completed', { screen: 'instagram', choice: 'skip' });
    router.replace('/(auth)/friends');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FAF8F3' }}>
      <Box flex={1} padding="xl" justifyContent="center">
        <Text variant="title" marginBottom="m">
          Bring your trips with you
        </Text>
        <Text variant="body" color="textMuted" marginBottom="xl">
          We can read your last 18 months of Instagram, group it into trips, and let you add a few
          words to each. Your posts stay private to you until you publish.
        </Text>
        <Box gap="m">
          <Button
            label="Connect Instagram"
            variant="accent"
            size="lg"
            fullWidth
            onPress={onConnect}
          />
          <Button label="Skip for now" variant="ghost" size="lg" fullWidth onPress={onSkip} />
        </Box>
      </Box>
    </SafeAreaView>
  );
}
