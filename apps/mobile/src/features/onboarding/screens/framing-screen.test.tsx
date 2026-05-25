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

// Stub the PlacePicker component directly so the test can drive its
// callbacks without going through real Google Places API. Targeting
// the component file (not the barrel) avoids pulling the whole
// @/components surface through jest.requireActual.
jest.mock('@/components/PlacePicker', () => {
  const React = require('react');
  const { Pressable, Text } = require('react-native');
  return {
    PlacePicker: ({
      onPick,
      onFreeText,
    }: {
      onPick: (d: unknown) => void;
      onFreeText: (s: string) => void;
    }) =>
      React.createElement(
        React.Fragment,
        null,
        React.createElement(
          Pressable,
          {
            accessibilityLabel: 'stub-pick-mumbai',
            onPress: () =>
              onPick({
                google_place_id: 'ChIJMumbai',
                name: 'Mumbai',
                country: 'India',
                region: 'Maharashtra',
                lat: 19.07,
                lng: 72.87,
                types: ['locality'],
              }),
          },
          React.createElement(Text, null, 'Pick Mumbai'),
        ),
        React.createElement(
          Pressable,
          {
            accessibilityLabel: 'stub-free-text',
            onPress: () => onFreeText('Mars'),
          },
          React.createElement(Text, null, 'Free text Mars'),
        ),
      ),
  };
});

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
});

describe('FramingScreen', () => {
  it('renders the name, bio, and the home-city PlacePicker', () => {
    renderWithProviders(<FramingScreen />);
    expect(screen.getByPlaceholderText('Shrey Arora')).toBeTruthy();
    expect(screen.getByPlaceholderText('Mostly cities, sometimes mountains.')).toBeTruthy();
    // PlacePicker stub renders two pressables — the picker is on screen
    // because home city starts empty.
    expect(screen.getByLabelText('stub-pick-mumbai')).toBeTruthy();
  });

  it('shows an error toast and skips the mutation when home city is empty', () => {
    renderWithProviders(<FramingScreen />);
    fireEvent.changeText(screen.getByPlaceholderText('Shrey Arora'), 'Shrey');
    fireEvent.press(screen.getByText('Continue'));
    expect(mockShowToast).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Tell us where you live.', variant: 'error' }),
    );
    expect(mockUpdateMutateAsync).not.toHaveBeenCalled();
  });

  it('picking a place via the picker forwards name + lat/lng to the mutation', async () => {
    mockUpdateMutateAsync.mockResolvedValue({});
    renderWithProviders(<FramingScreen />);
    fireEvent.changeText(screen.getByPlaceholderText('Shrey Arora'), 'Shrey');
    // Tap the stubbed "Pick Mumbai" affordance — this calls the picker's
    // onPick with a fixture PlaceDetails.
    fireEvent.press(screen.getByLabelText('stub-pick-mumbai'));
    fireEvent.press(screen.getByText('Continue'));
    await waitFor(() => {
      expect(mockUpdateMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          display_name: 'Shrey',
          home_city: 'Mumbai',
          home_lat: 19.07,
          home_lng: 72.87,
        }),
      );
    });
    expect(mockReplace).toHaveBeenCalledWith('/(auth)/circle');
  });

  it('free-text fallback saves the typed city with no lat/lng', async () => {
    mockUpdateMutateAsync.mockResolvedValue({});
    renderWithProviders(<FramingScreen />);
    fireEvent.changeText(screen.getByPlaceholderText('Shrey Arora'), 'Shrey');
    fireEvent.press(screen.getByLabelText('stub-free-text'));
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
