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
  // Initial entry — Welcome (#1 of the redesign Batch A). AuthGate in
  // _layout will fast-forward an authenticated user to the right next step
  // (or straight to /tabs/book if they're already onboarded) once the
  // session resolves.
  if (isSupabaseConfigured()) return <Redirect href="/(auth)/welcome" />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <Box flex={1} justifyContent="center" alignItems="center" padding="xl">
        <Text variant="title" textAlign="center" marginBottom="m">
          Vouch
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
