/**
 * Global jest setup. Mocks the noisy native modules so component tests focus
 * on behavior, not platform plumbing. Matchers are built into
 * @testing-library/react-native v13 — no extend-expect needed.
 */

type ChildrenProps = { children?: unknown };
type LinkProps = { children?: unknown; asChild?: boolean };
type ImageProps = { testID?: string; [k: string]: unknown };

// Silence Reanimated warnings (the test env doesn't have Worklets).
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

// expo-router — the parts we use in screens.
jest.mock('expo-router', () => {
  const React = require('react');
  return {
    useRouter: () => ({
      push: jest.fn(),
      replace: jest.fn(),
      back: jest.fn(),
    }),
    useLocalSearchParams: () => ({}),
    useSegments: () => [] as string[],
    Stack: { Screen: ({ children }: ChildrenProps) => children ?? null },
    Tabs: Object.assign(({ children }: ChildrenProps) => children ?? null, {
      Screen: () => null,
    }),
    Slot: ({ children }: ChildrenProps) => children ?? null,
    Link: ({ children, asChild }: LinkProps) => {
      if (asChild) return children;
      return React.createElement(require('react-native').Text, null, children);
    },
    Redirect: () => null,
  };
});

jest.mock('expo-font', () => ({
  loadAsync: jest.fn().mockResolvedValue(undefined),
  isLoaded: jest.fn().mockReturnValue(true),
}));

jest.mock('expo-image', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    Image: (props: ImageProps) =>
      React.createElement(View, { ...props, testID: props.testID ?? 'expo-image' }),
  };
});

jest.mock('expo-status-bar', () => ({
  StatusBar: () => null,
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('expo-crypto', () => ({
  digestStringAsync: jest.fn().mockResolvedValue('0'.repeat(64)),
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  CryptoEncoding: { HEX: 'hex' },
}));

jest.mock('expo-location', () => ({
  reverseGeocodeAsync: jest.fn().mockResolvedValue([]),
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  selectionAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
    Heavy: 'heavy',
    Soft: 'soft',
    Rigid: 'rigid',
  },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  addBreadcrumb: jest.fn(),
  setUser: jest.fn(),
}));

jest.mock('posthog-react-native', () => {
  return jest.fn().mockImplementation(() => ({
    capture: jest.fn(),
    identify: jest.fn(),
    reset: jest.fn(),
  }));
});

jest.mock('@/lib/supabase', () => {
  const noop = jest.fn().mockReturnValue({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
          single: jest.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    }),
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: jest.fn().mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } },
      }),
      signInAnonymously: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
    },
  });
  return {
    getSupabase: noop,
    isSupabaseConfigured: () => true,
  };
});
