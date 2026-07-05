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

// Stub the PlacePicker so the test can drive its callbacks without
// touching Google Places.
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
                country_iso: 'IN',
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
          { accessibilityLabel: 'stub-free-text', onPress: () => onFreeText('Mars') },
          React.createElement(Text, null, 'Free text Mars'),
        ),
      ),
  };
});

beforeEach(() => {
  mockReplace.mockReset();
  mockShowToast.mockReset();
  mockUpdateMutateAsync.mockReset();
});

describe('FramingScreen', () => {
  it('renders the name input and the home-city picker', () => {
    renderWithProviders(<FramingScreen />);
    expect(screen.getByPlaceholderText('Shrey Arora')).toBeTruthy();
    expect(screen.getByLabelText('stub-pick-mumbai')).toBeTruthy();
  });

  it('blocks Continue when the name is empty', () => {
    renderWithProviders(<FramingScreen />);
    fireEvent.press(screen.getByText('Continue'));
    expect(mockShowToast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'error' }));
    expect(mockUpdateMutateAsync).not.toHaveBeenCalled();
  });

  it('blocks Continue when the home city is empty', () => {
    renderWithProviders(<FramingScreen />);
    fireEvent.changeText(screen.getByPlaceholderText('Shrey Arora'), 'Shrey');
    fireEvent.press(screen.getByText('Continue'));
    expect(mockShowToast).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Where do you live?', variant: 'error' }),
    );
    expect(mockUpdateMutateAsync).not.toHaveBeenCalled();
  });

  it('picking a city forwards name + lat/lng and routes to taste-setup', async () => {
    mockUpdateMutateAsync.mockResolvedValue({});
    renderWithProviders(<FramingScreen />);
    fireEvent.changeText(screen.getByPlaceholderText('Shrey Arora'), 'Shrey');
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
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)/taste-setup');
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
