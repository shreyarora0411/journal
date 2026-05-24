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
jest.mock('@/features/auth', () => ({
  useStartSession: () => ({ mutateAsync: mockMutateAsync, isPending: false }),
  useAuthStore: <T,>(selector: (s: { session: null }) => T) => selector({ session: null }),
}));

beforeEach(() => {
  mockReplace.mockReset();
  mockMutateAsync.mockReset();
  mockShowToast.mockReset();
});

describe('LoginScreen', () => {
  it('renders the wordmark, OTP-style headline, sub copy, country pill and CTA', () => {
    renderWithProviders(<LoginScreen />);
    expect(screen.getByLabelText('lore.')).toBeTruthy();
    expect(screen.getByText('Sign in with the number\nyour friends already have.')).toBeTruthy();
    expect(screen.getByText(/We'll text you a one-time code/)).toBeTruthy();
    expect(screen.getByText('+91')).toBeTruthy();
    expect(screen.getByText('Send me a code')).toBeTruthy();
  });

  it('renders the OR FASTER divider and the camera-roll fast-path', () => {
    renderWithProviders(<LoginScreen />);
    expect(screen.getByText('OR FASTER')).toBeTruthy();
    expect(
      screen.getByLabelText("Continue with my camera roll — we'll find your trips"),
    ).toBeTruthy();
  });

  it('renders the emerald privacy reassurance line', () => {
    renderWithProviders(<LoginScreen />);
    expect(screen.getByText(/Only your circle sees you/)).toBeTruthy();
  });

  it('tapping Send me a code with an empty input toasts an error', () => {
    renderWithProviders(<LoginScreen />);
    fireEvent.press(screen.getByLabelText('Send me a code'));
    expect(mockShowToast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'error' }));
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it('typing 10 digits then Send me a code calls startSession with +91 prefix', async () => {
    mockMutateAsync.mockResolvedValueOnce(undefined);
    renderWithProviders(<LoginScreen />);
    fireEvent.changeText(screen.getByLabelText('Phone number'), '9876543210');
    fireEvent.press(screen.getByLabelText('Send me a code'));
    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({ phone: '+919876543210' });
      expect(mockReplace).toHaveBeenCalledWith('/(auth)/framing');
    });
  });

  it('tapping the camera-roll fast-path signs in anonymously and advances', async () => {
    mockMutateAsync.mockResolvedValueOnce(undefined);
    renderWithProviders(<LoginScreen />);
    fireEvent.press(screen.getByLabelText("Continue with my camera roll — we'll find your trips"));
    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({ phone: '' });
      expect(mockReplace).toHaveBeenCalledWith('/(auth)/framing');
    });
  });
});
