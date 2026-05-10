import { Box, Button, Text } from '@/components';
import { Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function Landing() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FAF8F5' }}>
      <Box flex={1} justifyContent="center" alignItems="center" padding="xl">
        <Text variant="title" textAlign="center" marginBottom="m">
          Journal
        </Text>
        <Text variant="body" color="textMuted" textAlign="center" marginBottom="xl">
          Friends-graph travel journal. Phase 0 scaffold — no product features yet.
        </Text>
        {__DEV__ ? (
          <Link href="/dev/components" asChild>
            <Button label="Open /dev/components" variant="ghost" />
          </Link>
        ) : null}
      </Box>
    </SafeAreaView>
  );
}
