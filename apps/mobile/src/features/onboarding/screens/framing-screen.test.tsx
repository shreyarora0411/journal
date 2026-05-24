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
const mockUploadAvatar = jest.fn();
jest.mock('@/features/auth', () => ({
  useUpdateProfile: () => ({ mutateAsync: mockUpdateMutateAsync, isPending: false }),
  useUploadAvatar: () => ({ mutateAsync: mockUploadAvatar, isPending: false }),
  useProfile: () => ({ data: null }),
  useAuthStore: <T,>(selector: (s: { session: null }) => T) => selector({ session: null }),
}));

const mockGeocodeAsync = jest.fn();
const mockReverseGeocodeAsync = jest.fn();
jest.mock('expo-location', () => ({
  geocodeAsync: (...args: unknown[]) => mockGeocodeAsync(...args),
  reverseGeocodeAsync: (...args: unknown[]) => mockReverseGeocodeAsync(...args),
}));

jest.mock('@/lib/supabase', () => ({
  getSupabase: () => ({
    from: () => ({ update: () => ({ eq: jest.fn().mockResolvedValue({ error: null }) }) }),
  }),
  isSupabaseConfigured: () => true,
}));

beforeEach(() => {
  mockReplace.mockReset();
  mockShowToast.mockReset();
  mockUpdateMutateAsync.mockReset();
  mockGeocodeAsync.mockReset();
  mockReverseGeocodeAsync.mockReset();
});

describe('FramingScreen', () => {
  it('renders the name, bio, and home-city fields', () => {
    renderWithProviders(<FramingScreen />);
    expect(screen.getByPlaceholderText('Shrey Arora')).toBeTruthy();
    expect(screen.getByPlaceholderText('Mostly cities, sometimes mountains.')).toBeTruthy();
    expect(screen.getByPlaceholderText('Mumbai, Bangalore, Delhi…')).toBeTruthy();
  });

  it('shows an error toast and skips the mutation when home city is empty', () => {
    renderWithProviders(<FramingScreen />);
    fireEvent.changeText(screen.getByPlaceholderText('Shrey Arora'), 'Shrey');
    // home city left empty
    fireEvent.press(screen.getByText('Continue'));
    expect(mockShowToast).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Tell us where you live.', variant: 'error' }),
    );
    expect(mockUpdateMutateAsync).not.toHaveBeenCalled();
  });

  it('geocodes the home city and forwards lat/lng/country to the mutation', async () => {
    mockGeocodeAsync.mockResolvedValue([{ latitude: 19.07, longitude: 72.87 }]);
    mockReverseGeocodeAsync.mockResolvedValue([{ isoCountryCode: 'IN' }]);
    mockUpdateMutateAsync.mockResolvedValue({});
    renderWithProviders(<FramingScreen />);
    fireEvent.changeText(screen.getByPlaceholderText('Shrey Arora'), 'Shrey');
    fireEvent.changeText(screen.getByPlaceholderText('Mumbai, Bangalore, Delhi…'), 'Mumbai');
    fireEvent.press(screen.getByText('Continue'));
    await waitFor(() => {
      expect(mockUpdateMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          display_name: 'Shrey',
          home_city: 'Mumbai',
          home_lat: 19.07,
          home_lng: 72.87,
          home_country_code: 'IN',
        }),
      );
    });
    expect(mockReplace).toHaveBeenCalledWith('/(auth)/circle');
  });

  it('still saves the home city when forward geocoding returns nothing', async () => {
    mockGeocodeAsync.mockResolvedValue([]);
    mockUpdateMutateAsync.mockResolvedValue({});
    renderWithProviders(<FramingScreen />);
    fireEvent.changeText(screen.getByPlaceholderText('Shrey Arora'), 'Shrey');
    fireEvent.changeText(screen.getByPlaceholderText('Mumbai, Bangalore, Delhi…'), 'Mars');
    fireEvent.press(screen.getByText('Continue'));
    await waitFor(() => {
      expect(mockUpdateMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ display_name: 'Shrey', home_city: 'Mars' }),
      );
    });
    const call = mockUpdateMutateAsync.mock.calls[0][0];
    expect(call.home_lat).toBeUndefined();
    expect(call.home_lng).toBeUndefined();
  });
});
