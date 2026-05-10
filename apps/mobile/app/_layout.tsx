import { ToastProvider } from '@/components';
import { initPostHog } from '@/lib/posthog';
import { initSentry } from '@/lib/sentry';
import { theme } from '@/theme';
import { Inter_400Regular, Inter_500Medium } from '@expo-google-fonts/inter';
import {
  Newsreader_400Regular,
  Newsreader_400Regular_Italic,
  Newsreader_500Medium,
} from '@expo-google-fonts/newsreader';
import { ThemeProvider } from '@shopify/restyle';
import * as Font from 'expo-font';
import { Slot } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

SplashScreen.preventAutoHideAsync().catch(() => {
  // Splash screen may already be hidden — non-fatal.
});

initSentry();

export default function RootLayout() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await Font.loadAsync({
          Newsreader_400Regular,
          Newsreader_400Regular_Italic,
          Newsreader_500Medium,
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
        <ThemeProvider theme={theme}>
          <ToastProvider>
            <StatusBar style="dark" />
            <Slot />
          </ToastProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
