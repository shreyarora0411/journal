import { ToastContext, type ToastInput, type ToastVariant } from '@/hooks/use-toast';
import type { Theme } from '@/theme';
import { useTheme } from '@shopify/restyle';
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from './Text';

type Visible = ToastInput & { id: number };

const DEFAULT_DURATION = 3200;

// useNativeDriver requires the RCTAnimation native module; on web it just
// warns and falls back to JS. Skip the flag on web.
const USE_NATIVE_DRIVER = Platform.OS !== 'web';

const colorFor = (variant: ToastVariant, theme: Theme) => {
  if (variant === 'error') return theme.colors.errorBg;
  if (variant === 'success') return theme.colors.successBg;
  return theme.colors.ink;
};

export function Toast({ toast, onDone }: { toast: Visible; onDone: () => void }) {
  const theme = useTheme<Theme>();
  const insets = useSafeAreaInsets();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.ease),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 220,
        easing: Easing.out(Easing.ease),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]).start();

    const t = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(translateY, {
          toValue: 8,
          duration: 180,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ]).start(() => onDone());
    }, toast.durationMs ?? DEFAULT_DURATION);

    return () => clearTimeout(t);
  }, [toast, opacity, translateY, onDone]);

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        { paddingBottom: insets.bottom + 16, opacity, transform: [{ translateY }] },
      ]}
    >
      <View style={[styles.toast, { backgroundColor: colorFor(toast.variant ?? 'info', theme) }]}>
        {/* DM Sans matches the theme's `body` text variant — Toast is
            cross-cutting and shows over both onboarding (DM Sans) and
            taste (Hanken Grotesk) screens, so DM Sans is the safer default. */}
        <Text style={{ color: theme.colors.paper }} fontFamily="DMSans_400Regular" fontSize={15}>
          {toast.message}
        </Text>
      </View>
    </Animated.View>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<Visible[]>([]);
  const idRef = useRef(0);

  const show = useCallback((input: ToastInput) => {
    idRef.current += 1;
    const next: Visible = { ...input, id: idRef.current };
    setQueue((q) => [...q, next]);
  }, []);

  const dismiss = useCallback((id: number) => {
    setQueue((q) => q.filter((t) => t.id !== id));
  }, []);

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {(() => {
        const head = queue[0];
        return head ? <Toast key={head.id} toast={head} onDone={() => dismiss(head.id)} /> : null;
      })()}
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  toast: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    maxWidth: 480,
  },
});
