import { Box, Text } from '@/components';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function FeedScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FAF8F5' }}>
      <Box flex={1} padding="l">
        <Text variant="title">Feed</Text>
        <Text variant="caption" marginTop="s">
          Empty — Phase 4.
        </Text>
      </Box>
    </SafeAreaView>
  );
}
