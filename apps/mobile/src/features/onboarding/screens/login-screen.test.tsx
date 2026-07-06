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

const mockFetchSelf = jest.fn();
jest.mock('@/features/auth/api/use-profile', () => ({
  fetchSelf: (userId: string) => mockFetchSelf(userId),
}));

// jest.setup.ts's global supabase mock resolves auth.getUser() with a null
// user by default; override its return value per-test via this reference to
// exercise the post-signin profile fetch + routing branch. Cast to jest.Mock
// since the real SDK types auth.getUser as a plain async function.
const { getSupabase: mockGetSupabase } =
  jest.requireMock<typeof import('@/lib/supabase')>('@/lib/supabase');
const mockGetUser = () => mockGetSupabase().auth.getUser as unknown as jest.Mock;

beforeEach(() => {
  mockReplace.mockReset();
  mockMutateAsync.mockReset();
  mockShowToast.mockReset();
  mockFetchSelf.mockReset();
  mockGetUser()
    .mockReset()
    .mockResolvedValue({
      data: { user: null },
      error: null,
    });
});

describe('LoginScreen', () => {
  it('renders the wordmark, headline, sub copy, country pill and CTA — no OTP claim', () => {
    renderWithProviders(<LoginScreen />);
    expect(screen.getByLabelText('Vouch.')).toBeTruthy();
    expect(screen.getByText('Sign in with the number\nyour friends already have.')).toBeTruthy();
    // No SMS provider is wired — the copy must never promise a text that
    // never sends (2026-07-05 security/copy fix).
    expect(screen.queryByText(/text you/i)).toBeNull();
    expect(screen.getByText(/Used to recognize your account if you come back/)).toBeTruthy();
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
    expect(screen.getByText(/Your number is never visible to anyone/)).toBeTruthy();
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
    // getUser resolves with no user by default (see beforeEach) — the
    // explicit no-user guard fires and we never reach replace(); this test
    // only asserts the mutateAsync call shape, not the routing branch below.
    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'error' }));
    });
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('routes a signed-in user with a name but incomplete onboarding to taste-setup, not circle', async () => {
    // Regression test: onContinue's success path used to hand-roll its own
    // three-way branch that sent this exact profile shape to
    // /(auth)/circle — a screen cut from the launch path whose finish()
    // stamps onboarding_completed on Continue/Skip, letting a user "finish"
    // onboarding having never seen taste-setup. It must delegate to
    // onboardingNextRoute() (the single source of truth) instead.
    mockMutateAsync.mockResolvedValueOnce(undefined);
    mockGetUser().mockResolvedValueOnce({
      data: { user: { id: 'user-1' } },
      error: null,
    });
    mockFetchSelf.mockResolvedValueOnce({
      id: 'user-1',
      display_name: 'Shrey',
      onboarding_completed_at: null,
    });
    renderWithProviders(<LoginScreen />);
    fireEvent.changeText(screen.getByLabelText('Phone number'), '9876543210');
    fireEvent.press(screen.getByLabelText('Continue'));
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/(tabs)/taste-setup');
    });
  });

  it('routes a fully onboarded user straight to book', async () => {
    mockMutateAsync.mockResolvedValueOnce(undefined);
    mockGetUser().mockResolvedValueOnce({
      data: { user: { id: 'user-1' } },
      error: null,
    });
    mockFetchSelf.mockResolvedValueOnce({
      id: 'user-1',
      display_name: 'Shrey',
      onboarding_completed_at: '2026-01-01T00:00:00Z',
    });
    renderWithProviders(<LoginScreen />);
    fireEvent.changeText(screen.getByLabelText('Phone number'), '9876543210');
    fireEvent.press(screen.getByLabelText('Continue'));
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/(tabs)/book');
    });
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
