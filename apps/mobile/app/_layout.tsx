import { ToastProvider } from '@/components';
import { useAuthSession, useAuthStore, useProfile } from '@/features/auth';
import { onboardingNextRoute } from '@/features/onboarding';
import { initPostHog } from '@/lib/posthog';
import { initSentry } from '@/lib/sentry';
import { isSupabaseConfigured } from '@/lib/supabase';
import { theme } from '@/theme';
import {
  Fraunces_400Regular,
  Fraunces_400Regular_Italic,
  Fraunces_500Medium,
} from '@expo-google-fonts/fraunces';
import { Inter_400Regular, Inter_500Medium } from '@expo-google-fonts/inter';
import { ThemeProvider } from '@shopify/restyle';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as Font from 'expo-font';
import { Slot, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

SplashScreen.preventAutoHideAsync().catch(() => {
  // Splash screen may already be hidden — non-fatal.
});

initSentry();

function AuthGate() {
  useAuthSession();
  const session = useAuthStore((s) => s.session);
  const initializing = useAuthStore((s) => s.initializing);
  const segments = useSegments();
  const router = useRouter();
  const profileQ = useProfile();

  useEffect(() => {
    if (initializing) return;
    if (!isSupabaseConfigured()) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inDevGroup = segments[0] === 'dev';

    if (!session) {
      if (!inAuthGroup) router.replace('/(auth)/phone');
      return;
    }
    if (profileQ.isLoading) return;

    const next = onboardingNextRoute(profileQ.data ?? null);
    const onboarded = profileQ.data?.onboarding_completed_at != null;

    if (onboarded) {
      if (inAuthGroup) router.replace('/(tabs)/feed');
      return;
    }

    if (!inDevGroup && !inAuthGroup) {
      router.replace(next as never);
    }
  }, [session, initializing, segments, profileQ.data, profileQ.isLoading, router]);

  return <Slot />;
}

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const queryClient = useMemo(
    () => new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30_000 } } }),
    [],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await Font.loadAsync({
          Fraunces_400: Fraunces_400Regular,
          Fraunces_400Italic: Fraunces_400Regular_Italic,
          Fraunces_500: Fraunces_500Medium,
          Inter_400Regular,
          Inter_500Medium,
        });
        await initPostHog();
      } finally {
        if (!cancelled) {
          setReady(true);
          await SplashScreen.hideAsync().catch(() => undefined);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider theme={theme}>
            <ToastProvider>
              <StatusBar style="dark" />
              <AuthGate />
            </ToastProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
