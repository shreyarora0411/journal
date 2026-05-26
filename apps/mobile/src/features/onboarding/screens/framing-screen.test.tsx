import { fireEvent, renderWithProviders, screen, waitFor } from '@/test/render';
import { FramingScreen } from './framing-screen';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn(), back: jest.fn() }),
}));

const mockShowToast = jest.fn();
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ show: mockShowToast }),
  ToastContext: { Provider: ({ children }: { children: React.ReactNode }) => children },
}));

const mockUpdateMutateAsync = jest.fn();
jest.mock('@/features/auth', () => ({
  useUpdateProfile: () => ({ mutateAsync: mockUpdateMutateAsync, isPending: false }),
  useAuthStore: <T,>(selector: (s: { session: null }) => T) => selector({ session: null }),
}));

beforeEach(() => {
  mockReplace.mockReset();
  mockShowToast.mockReset();
  mockUpdateMutateAsync.mockReset();
});

describe('FramingScreen (name-only pilot)', () => {
  it('renders the name input', () => {
    renderWithProviders(<FramingScreen />);
    expect(screen.getByPlaceholderText('Shrey Arora')).toBeTruthy();
    expect(screen.getByText(/What should/)).toBeTruthy();
  });

  it('shows an error toast when name is empty on Continue', () => {
    renderWithProviders(<FramingScreen />);
    fireEvent.press(screen.getByText('Continue'));
    expect(mockShowToast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'error' }));
    expect(mockUpdateMutateAsync).not.toHaveBeenCalled();
  });

  it('forwards display_name to the mutation and routes to /circle', async () => {
    mockUpdateMutateAsync.mockResolvedValue({});
    renderWithProviders(<FramingScreen />);
    fireEvent.changeText(screen.getByPlaceholderText('Shrey Arora'), 'Shrey');
    fireEvent.press(screen.getByText('Continue'));
    await waitFor(() => {
      expect(mockUpdateMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ display_name: 'Shrey' }),
      );
    });
    expect(mockReplace).toHaveBeenCalledWith('/(auth)/circle');
  });
});
