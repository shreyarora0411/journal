import { Box, Button, Text } from '@/components';
import { log } from '@/lib/log';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

/**
 * Conditional — only reached if the user hits "Connect Instagram" in
 * onboarding. The actual cluster-and-confirm UI is built in Phase 4.2.
 */
export function ImportScreen() {
  const router = useRouter();

  useEffect(() => {
    log.event('onboarding.screen_entered', { screen: 'import' });
  }, []);

  const onContinue = () => {
    log.event('onboarding.screen_completed', { screen: 'import' });
    router.replace('/(auth)/friends');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FAF8F3' }}>
      <Box flex={1} padding="xl" justifyContent="center">
        <Text variant="title" marginBottom="m">
          Pulling your trips…
        </Text>
        <Text variant="body" color="textMuted" marginBottom="xl">
          We’ll cluster your photos into trips so you can fill in the prose later. This is a stub
          for Phase 1—real import lands in Phase 4.
        </Text>
        <Button label="Continue" onPress={onContinue} fullWidth size="lg" />
      </Box>
    </SafeAreaView>
  );
}
