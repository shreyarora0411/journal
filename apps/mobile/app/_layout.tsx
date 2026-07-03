import { ToastProvider } from '@/components';
import { useAuthSession, useAuthStore, useProfile } from '@/features/auth';
import { applyPendingFollow, handleFollowUrl } from '@/features/invite';
import { onboardingNextRoute } from '@/features/onboarding';
import { initPostHog } from '@/lib/posthog';
import { initSentry } from '@/lib/sentry';
import { isSupabaseConfigured } from '@/lib/supabase';
import { theme } from '@/theme';
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
} from '@expo-google-fonts/dm-sans';
import {
  Fraunces_400Regular,
  Fraunces_400Regular_Italic,
  Fraunces_500Medium,
} from '@expo-google-fonts/fraunces';
import { Geist_400Regular, Geist_500Medium } from '@expo-google-fonts/geist';
import {
  HankenGrotesk_400Regular,
  HankenGrotesk_500Medium,
  HankenGrotesk_600SemiBold,
  HankenGrotesk_700Bold,
} from '@expo-google-fonts/hanken-grotesk';
import { InstrumentSerif_400Regular_Italic } from '@expo-google-fonts/instrument-serif';
import { Inter_400Regular, Inter_500Medium } from '@expo-google-fonts/inter';
import { JetBrainsMono_400Regular } from '@expo-google-fonts/jetbrains-mono';
import {
  PlayfairDisplay_500Medium,
  PlayfairDisplay_500Medium_Italic,
  PlayfairDisplay_600SemiBold,
} from '@expo-google-fonts/playfair-display';
import { ThemeProvider } from '@shopify/restyle';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as Font from 'expo-font';
import * as Linking from 'expo-linking';
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

  // Deep-link auto-follow: opening lore://follow?id=<userId> follows that user
  // once the viewer has a session. Captures both the cold-open URL
  // (getInitialURL) and warm-open URLs (addEventListener). If the link arrives
  // before a session exists it's stashed and replayed here when `session`
  // flips truthy (and again by use-start-session for the just-signed-in path).
  // See features/invite/lib/pending-follow.ts for the cold-install caveat.
  useEffect(() => {
    let cancelled = false;

    Linking.getInitialURL()
      .then((url) => {
        if (!cancelled) return handleFollowUrl(url);
      })
      .catch(() => undefined);

    const sub = Linking.addEventListener('url', ({ url }) => {
      handleFollowUrl(url).catch(() => undefined);
    });

    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);

  // When a session appears (sign-in completes), drain any follow that was
  // stashed before we had one.
  useEffect(() => {
    if (session) applyPendingFollow().catch(() => undefined);
  }, [session]);

  useEffect(() => {
    if (initializing) return;
    if (!isSupabaseConfigured()) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inDevGroup = segments[0] === 'dev';
    // The circle/build-your-circle screen is reachable AFTER onboarding too
    // (re-entry from the Friends tab), so an already-onboarded user must be
    // allowed to sit on it without being bounced back to the feed.
    const onCircleScreen = inAuthGroup && segments[1] === 'circle';

    if (!session) {
      // Unauthenticated users enter via the Cover screen (#01 in design pack).
      if (!inAuthGroup) router.replace('/(auth)/welcome');
      return;
    }
    if (profileQ.isLoading) return;

    const next = onboardingNextRoute(profileQ.data ?? null);
    const onboarded = profileQ.data?.onboarding_completed_at != null;

    if (onboarded) {
      if (inAuthGroup && !onCircleScreen) router.replace('/(tabs)/book');
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
          // Vouch identity type stack — Fraunces (display + voiced quotes) +
          // Hanken Grotesk (UI/body). Chosen for the emotional-voice thesis:
          // a warm characterful serif makes a friend's quote read human, the
          // grotesque keeps the chrome clean. Rolling out screen by screen.
          HankenGrotesk_400Regular,
          HankenGrotesk_500Medium,
          HankenGrotesk_600SemiBold,
          HankenGrotesk_700Bold,
          // New lore-redesign type stack
          InstrumentSerif_400Italic: InstrumentSerif_400Regular_Italic,
          Geist_400Regular,
          Geist_500Medium,
          JetBrainsMono_400Regular,
          // Feed redesign — Playfair Display (titles, wordmark) + DM Sans
          // (UI, labels). Used by feed-screen.tsx and FloatingTabBar.
          PlayfairDisplay_500Medium,
          PlayfairDisplay_500Medium_Italic,
          PlayfairDisplay_600SemiBold,
          DMSans_400Regular,
          DMSans_500Medium,
          DMSans_600SemiBold,
          DMSans_700Bold,
          // Legacy — still referenced by slice-1/2/3 screens until they're
          // rebuilt in Batch A. Will be dropped once nothing imports them.
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
