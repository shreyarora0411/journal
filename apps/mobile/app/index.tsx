import { Box, Button, Text } from '@/components';
import { isSupabaseConfigured } from '@/lib/supabase';
import { Redirect } from 'expo-router';
import { Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

/**
 * Entry route. The AuthGate inside _layout will redirect once the session is
 * known. If Supabase isn't configured (dev without env), show a setup hint
 * and a link to /dev/components.
 */
export default function Landing() {
  if (isSupabaseConfigured()) return <Redirect href="/(auth)/phone" />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FAF8F3' }}>
      <Box flex={1} justifyContent="center" alignItems="center" padding="xl">
        <Text variant="title" textAlign="center" marginBottom="m">
          Postmark
        </Text>
        <Text variant="body" color="textMuted" textAlign="center" marginBottom="xl">
          Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in apps/mobile/.env to
          enable auth.
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
