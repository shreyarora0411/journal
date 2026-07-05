import { fireEvent, renderWithProviders, screen, waitFor } from '@/test/render';
import { LoginScreen } from './login-screen';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn(), back: jest.fn() }),
  Link: ({ children }: { children: React.ReactNode }) => children,
}));

const mockShowToast = jest.fn();
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ show: mockShowToast }),
  ToastContext: { Provider: ({ children }: { children: React.ReactNode }) => children },
}));

const mockMutateAsync = jest.fn();
// The class is declared INSIDE the factory (no external reference) so Jest's
// mock-hoisting (which moves this call above regular top-level declarations,
// including a same-file class) can never see it as undefined.
jest.mock('@/features/auth', () => {
  class KnownPhoneNoRecoveryError extends Error {
    constructor() {
      super(
        'This number already has a Vouch account. Ask whoever invited you to help you get back in — self-serve recovery is coming soon.',
      );
      this.name = 'KnownPhoneNoRecoveryError';
    }
  }
  return {
    useStartSession: () => ({ mutateAsync: mockMutateAsync, isPending: false }),
    useAuthStore: <T,>(selector: (s: { session: null }) => T) => selector({ session: null }),
    KnownPhoneNoRecoveryError,
  };
});
// Re-import the mocked module to get the SAME class reference the component
// sees, so `new` here and `instanceof` in the component agree.
const { KnownPhoneNoRecoveryError: MockedKnownPhoneNoRecoveryError } =
  jest.requireMock<typeof import('@/features/auth')>('@/features/auth');

beforeEach(() => {
  mockReplace.mockReset();
  mockMutateAsync.mockReset();
  mockShowToast.mockReset();
});

describe('LoginScreen', () => {
  it('renders the wordmark, headline, sub copy, country pill and CTA — no OTP claim', () => {
    renderWithProviders(<LoginScreen />);
    expect(screen.getByLabelText('Vouch.')).toBeTruthy();
    expect(screen.getByText('Sign in with the number\nyour friends already have.')).toBeTruthy();
    // No SMS provider is wired — the copy must never promise a text that
    // never sends (2026-07-05 security/copy fix).
    expect(screen.queryByText(/text you/i)).toBeNull();
    expect(screen.getByText(/Used only to match you with people you actually know/)).toBeTruthy();
    expect(screen.getByText('+91')).toBeTruthy();
    expect(screen.getByText('Continue')).toBeTruthy();
  });

  it('does NOT render the OR FASTER divider or camera-roll fast-path', () => {
    // Pilot-fixes session: phone-only sign-in. Anything that looked like
    // an import shortcut has been cut.
    renderWithProviders(<LoginScreen />);
    expect(screen.queryByText('OR FASTER')).toBeNull();
    expect(
      screen.queryByLabelText("Continue with my camera roll — we'll find your trips"),
    ).toBeNull();
  });

  it('renders the emerald privacy reassurance line', () => {
    renderWithProviders(<LoginScreen />);
    expect(screen.getByText(/Only your circle sees you/)).toBeTruthy();
  });

  it('tapping Continue with an empty input toasts an error', () => {
    renderWithProviders(<LoginScreen />);
    fireEvent.press(screen.getByLabelText('Continue'));
    expect(mockShowToast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'error' }));
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it('typing 10 digits then Continue calls startSession with +91 prefix', async () => {
    mockMutateAsync.mockResolvedValueOnce(undefined);
    renderWithProviders(<LoginScreen />);
    fireEvent.changeText(screen.getByLabelText('Phone number'), '9876543210');
    fireEvent.press(screen.getByLabelText('Continue'));
    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({ phone: '+919876543210' });
    });
    // Routing intentionally NOT done from this screen — the AuthGate in
    // app/_layout.tsx handles post-signin navigation based on the freshly
    // settled profile (returning users → /book, new users → /framing).
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('a known phone with no self-serve recovery shows the honest error, not a generic retry', async () => {
    mockMutateAsync.mockRejectedValueOnce(new MockedKnownPhoneNoRecoveryError());
    renderWithProviders(<LoginScreen />);
    fireEvent.changeText(screen.getByLabelText('Phone number'), '9876543210');
    fireEvent.press(screen.getByLabelText('Continue'));
    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: 'error',
          message: expect.stringContaining('already has a Vouch account'),
        }),
      );
    });
  });
});
