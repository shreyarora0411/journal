import { fireEvent, renderWithProviders, screen } from '@/test/render';
import { ProfileScreen } from './profile-screen';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
  Link: ({ children }: { children: React.ReactNode }) => children,
}));

beforeEach(() => {
  mockPush.mockReset();
});

describe('ProfileScreen', () => {
  it('renders the user name, tagline pull-quote, and three stats', () => {
    renderWithProviders(<ProfileScreen />);
    expect(screen.getByText('Shrey Arora')).toBeTruthy();
    expect(screen.getByText('@shrey')).toBeTruthy();
    expect(screen.getByText(/Cities mostly/)).toBeTruthy();
    expect(screen.getByText('23')).toBeTruthy();
    expect(screen.getByText('11')).toBeTruthy();
    expect(screen.getByText('142')).toBeTruthy();
  });

  it('renders the Wrapped teaser with the right CTA copy', () => {
    renderWithProviders(<ProfileScreen />);
    expect(screen.getByText('MY 2026, SO FAR')).toBeTruthy();
    expect(screen.getByText('I really\nmoved this year.')).toBeTruthy();
  });

  it('tapping the Wrapped teaser routes to /wrapped', () => {
    renderWithProviders(<ProfileScreen />);
    fireEvent.press(screen.getByLabelText('Open my 2026 Wrapped'));
    expect(mockPush).toHaveBeenCalledWith('/wrapped');
  });

  it('tapping a trip card routes to its trip-notebook route', () => {
    renderWithProviders(<ProfileScreen />);
    fireEvent.press(screen.getByLabelText('Tokyo'));
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/trip-notebook/kabir-tokyo');
  });
});
