import { fireEvent, renderWithProviders, screen, waitFor } from '@/test/render';
import { PhoneScreen } from './phone-screen';

const mockReplace = jest.fn();
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: jest.fn() }),
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
  mockPush.mockReset();
  mockShowToast.mockReset();
  mockMutateAsync.mockReset();
});

describe('PhoneScreen', () => {
  it('renders the step header with step 1 of 4', () => {
    renderWithProviders(<PhoneScreen />);
    expect(screen.getByText('STEP 1 OF 4')).toBeTruthy();
    expect(screen.getByLabelText('lore.')).toBeTruthy();
  });

  it('renders the headline and privacy copy', () => {
    renderWithProviders(<PhoneScreen />);
    expect(screen.getByText(/Sign in with the number/)).toBeTruthy();
    expect(screen.getByText(/your friends already have/)).toBeTruthy();
    expect(screen.getByText(/Never shown, never sold\./)).toBeTruthy();
  });

  it('renders the country pill, OR FASTER divider, and camera-roll card', () => {
    renderWithProviders(<PhoneScreen />);
    expect(screen.getByText('+91')).toBeTruthy();
    expect(screen.getByText('OR FASTER')).toBeTruthy();
    expect(screen.getByText('Continue with your camera roll')).toBeTruthy();
  });

  it('tapping Continue with empty input shows an error toast', () => {
    renderWithProviders(<PhoneScreen />);
    fireEvent.press(screen.getByText('Continue'));
    expect(mockShowToast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'error' }));
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it('typing 10 digits and tapping Continue calls startSession with +91 prefix', async () => {
    mockMutateAsync.mockResolvedValueOnce(undefined);
    renderWithProviders(<PhoneScreen />);
    const input = screen.getByPlaceholderText('98765 43210');
    fireEvent.changeText(input, '9876543210');
    fireEvent.press(screen.getByText('Continue'));
    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({ phone: '+919876543210' });
    });
    expect(mockReplace).toHaveBeenCalledWith('/(auth)/framing');
  });

  it('tapping the camera-roll card navigates to /(auth)/import', () => {
    renderWithProviders(<PhoneScreen />);
    fireEvent.press(screen.getByLabelText('Continue with your camera roll'));
    expect(mockPush).toHaveBeenCalledWith('/(auth)/import');
  });

  it('tapping house rules navigates to /house-rules', () => {
    renderWithProviders(<PhoneScreen />);
    fireEvent.press(screen.getByText('house rules'));
    expect(mockPush).toHaveBeenCalledWith('/house-rules');
  });
});
