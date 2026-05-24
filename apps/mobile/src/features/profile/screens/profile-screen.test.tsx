import { fireEvent, renderWithProviders, screen } from '@/test/render';
import { ProfileScreen } from './profile-screen';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
  Link: ({ children }: { children: React.ReactNode }) => children,
}));

const mockSignOut = jest.fn();
jest.mock('@/features/auth', () => ({
  useSignOut: () => ({ mutateAsync: mockSignOut, isPending: false }),
  // `useMeStats` (default) returns `{ data: undefined, isLoading: true }`
  // via the real implementation under the test render — which means the
  // Profile screen renders `—` for the three stat values. That's the
  // honest loading state per the brief.
}));

const mockStats = jest.fn();
jest.mock('../api/use-me-stats', () => ({
  useMeStats: () => mockStats(),
}));

beforeEach(() => {
  mockPush.mockReset();
  mockSignOut.mockReset();
  mockStats.mockReset();
  mockStats.mockReturnValue({ data: null, isLoading: true });
});

describe('ProfileScreen', () => {
  it('renders em-dashes for stats while me_stats is loading', () => {
    renderWithProviders(<ProfileScreen />);
    expect(screen.getByText('Shrey Arora')).toBeTruthy();
    expect(screen.getByText('@shrey')).toBeTruthy();
    expect(screen.getByText(/Cities mostly/)).toBeTruthy();
    // 3 em-dashes (Trips / Countries / Tips I gave) while data is null.
    expect(screen.getAllByText('—').length).toBe(3);
  });

  it('renders real numbers when me_stats resolves', () => {
    mockStats.mockReturnValue({
      data: { trips_count: 7, countries_count: 4, tips_given_count: 19 },
      isLoading: false,
    });
    renderWithProviders(<ProfileScreen />);
    expect(screen.getByText('7')).toBeTruthy();
    expect(screen.getByText('4')).toBeTruthy();
    expect(screen.getByText('19')).toBeTruthy();
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
