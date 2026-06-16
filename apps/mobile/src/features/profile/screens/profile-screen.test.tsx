import { renderWithProviders, screen } from '@/test/render';
import { ProfileScreen } from './profile-screen';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
  Link: ({ children }: { children: React.ReactNode }) => children,
}));

const mockSignOut = jest.fn();
const mockProfile = jest.fn();
jest.mock('@/features/auth', () => ({
  useSignOut: () => ({ mutateAsync: mockSignOut, isPending: false }),
  useProfile: () => mockProfile(),
  useAuthStore: <T,>(selector: (s: { session: { user: { id: string } } | null }) => T) =>
    selector({ session: { user: { id: 'user-self' } } }),
}));

const mockStats = jest.fn();
jest.mock('../api/use-me-stats', () => ({
  useMeStats: () => mockStats(),
}));

const mockTrips = jest.fn();
jest.mock('../api/use-user-trips', () => ({
  useUserTrips: () => mockTrips(),
}));

const mockAtomicLogs = jest.fn();
const mockDeleteTip = jest.fn();
jest.mock('@/features/trips', () => ({
  useMyAtomicLogs: () => mockAtomicLogs(),
  useDeleteAtomicLog: () => ({ mutateAsync: mockDeleteTip, isPending: false }),
}));

const mockLists = jest.fn();
const mockDeleteList = jest.fn();
jest.mock('@/features/lists', () => ({
  useMyLists: () => mockLists(),
  useDeleteList: () => ({ mutateAsync: mockDeleteList, isPending: false }),
}));

const mockWishlist = jest.fn();
jest.mock('@/features/wishlist', () => ({
  useWishlistRows: () => mockWishlist(),
}));

const mockToastShow = jest.fn();
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ show: mockToastShow }),
  ToastContext: { Provider: ({ children }: { children: React.ReactNode }) => children },
}));

beforeEach(() => {
  mockPush.mockReset();
  mockSignOut.mockReset();
  mockStats.mockReset();
  mockProfile.mockReset();
  mockTrips.mockReset();
  mockAtomicLogs.mockReset();
  mockLists.mockReset();
  mockWishlist.mockReset();
  mockStats.mockReturnValue({ data: null, isLoading: true });
  mockProfile.mockReturnValue({
    data: { display_name: 'Shrey', handle: 'shrey', avatar_url: null },
    isLoading: false,
  });
  mockTrips.mockReturnValue({ data: [], isLoading: false });
  mockAtomicLogs.mockReturnValue({ data: [], isLoading: false });
  mockLists.mockReturnValue({ data: [], isLoading: false });
  mockWishlist.mockReturnValue({ data: [], isLoading: false });
});

describe('ProfileScreen', () => {
  it('renders em-dashes for stats while me_stats is loading', () => {
    renderWithProviders(<ProfileScreen />);
    expect(screen.getByText('Shrey')).toBeTruthy();
    expect(screen.getByText('@shrey')).toBeTruthy();
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

  it('hides the Wrapped teaser when the user has no trips/countries/tips', () => {
    mockStats.mockReturnValue({
      data: { trips_count: 0, countries_count: 0, tips_given_count: 0 },
      isLoading: false,
    });
    renderWithProviders(<ProfileScreen />);
    expect(screen.queryByLabelText('Open my Wrapped')).toBeNull();
  });

  it('renders the Wrapped teaser when stats are non-zero', () => {
    mockStats.mockReturnValue({
      data: { trips_count: 2, countries_count: 1, tips_given_count: 0 },
      isLoading: false,
    });
    renderWithProviders(<ProfileScreen />);
    expect(screen.getByLabelText('Open my Wrapped')).toBeTruthy();
  });

  it('renders the I-wrote section header when the user has no trips yet', () => {
    renderWithProviders(<ProfileScreen />);
    expect(screen.getByText('I WROTE')).toBeTruthy();
    expect(screen.getByText(/Add your first trip/)).toBeTruthy();
  });

  it('renders trip cards when useUserTrips returns rows', () => {
    mockTrips.mockReturnValue({
      data: [
        {
          id: 'trip-1',
          user_id: 'user-self',
          title: 'Tokyo, October',
          start_date: null,
          end_date: null,
          note: null,
          cover_photo_id: null,
          visibility: 'friends_of_friends',
          imported_from: null,
          created_at: '2026-01-15T10:00:00Z',
          updated_at: '2026-01-15T10:00:00Z',
          deleted_at: null,
        },
      ],
      isLoading: false,
    });
    renderWithProviders(<ProfileScreen />);
    expect(screen.getByText('Tokyo, October')).toBeTruthy();
  });
});
