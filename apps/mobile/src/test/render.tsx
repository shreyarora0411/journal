import { ToastProvider } from '@/components/Toast';
import { theme } from '@/theme';
import { ThemeProvider } from '@shopify/restyle';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type RenderOptions, render } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

/**
 * Renders a component inside the same provider stack as the real app:
 * Theme + TanStack Query + SafeArea + Toast.
 *
 * Tests that need a specific QueryClient state can pass one in via `client`.
 */
type Options = RenderOptions & {
  client?: QueryClient;
};

const makeClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

const initialMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

export function renderWithProviders(ui: ReactElement, options: Options = {}) {
  const { client, ...rest } = options;
  const queryClient = client ?? makeClient();
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <SafeAreaProvider initialMetrics={initialMetrics}>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider theme={theme}>
            <ToastProvider>{children}</ToastProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    );
  }
  return render(ui, { wrapper: Wrapper, ...rest });
}

export * from '@testing-library/react-native';
