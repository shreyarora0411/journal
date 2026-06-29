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
const mockVouches = jest.fn();
const mockVouchUses = jest.fn();
const mockUpdateVouch = jest.fn();
const mockDeleteVouch = jest.fn();
jest.mock('@/features/trips', () => ({
  useMyAtomicLogs: () => mockAtomicLogs(),
  useDeleteAtomicLog: () => ({ mutateAsync: mockDeleteTip, isPending: false }),
  useMyVouches: () => mockVouches(),
  useVouchUses: () => mockVouchUses(),
  useUpdateVouch: () => ({ mutateAsync: mockUpdateVouch, isPending: false }),
  useDeleteVouch: () => ({ mutateAsync: mockDeleteVouch, isPending: false }),
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
  mockVouches.mockReset();
  mockVouchUses.mockReset();
  mockLists.mockReset();
  mockWishlist.mockReset();
  mockVouchUses.mockReturnValue({ data: [], isLoading: false });
  mockStats.mockReturnValue({ data: null, isLoading: true });
  mockProfile.mockReturnValue({
    data: { display_name: 'Shrey', handle: 'shrey', avatar_url: null },
    isLoading: false,
  });
  mockTrips.mockReturnValue({ data: [], isLoading: false });
  mockAtomicLogs.mockReturnValue({ data: [], isLoading: false });
  mockVouches.mockReturnValue({ data: [], isLoading: false });
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

  it('never renders the Wrapped teaser — the /wrapped screen shows fabricated fixture stats', () => {
    // Teaser removed for ship safety (P0): it routed to a /wrapped screen that
    // renders hardcoded WRAPPED_2026 fixtures as the user's own year.
    mockStats.mockReturnValue({
      data: { trips_count: 2, countries_count: 1, tips_given_count: 0 },
      isLoading: false,
    });
    renderWithProviders(<ProfileScreen />);
    expect(screen.queryByLabelText('Open my Wrapped')).toBeNull();
  });

  it('renders the I-wrote section header when the user has no trips yet', () => {
    renderWithProviders(<ProfileScreen />);
    expect(screen.getByText('I WROTE')).toBeTruthy();
    expect(screen.getByText(/Add your first trip/)).toBeTruthy();
  });

  it('shows owner Edit/Delete affordances on each of the viewer own vouches', () => {
    mockVouches.mockReturnValue({
      data: [
        {
          id: 'vouch-1',
          text: 'The corner table at Olive is the only one to book.',
          vouch_type: 'eat_drink',
          destination_text: 'Goa',
          created_at: '2026-01-15T10:00:00Z',
        },
      ],
      isLoading: false,
    });
    renderWithProviders(<ProfileScreen />);
    expect(screen.getByLabelText('Edit vouch')).toBeTruthy();
    expect(screen.getByLabelText('Delete vouch')).toBeTruthy();
  });

  it('hides "Used by your circle" when no one has saved a vouch', () => {
    renderWithProviders(<ProfileScreen />);
    expect(screen.queryByText('USED BY YOUR CIRCLE')).toBeNull();
  });

  it('renders "Used by your circle" with the saver and quote when there are saves', () => {
    mockVouchUses.mockReturnValue({
      data: [
        {
          vouch_id: 'vouch-1',
          vouch_text: 'The corner table at Olive is the only one to book.',
          vouch_type: 'eat_drink',
          destination_text: 'Goa',
          saver_id: 'saver-9',
          saver_name: 'Mira',
          saver_handle: 'mira',
          saver_avatar: null,
          saved_at: '2026-02-01T10:00:00Z',
        },
      ],
      isLoading: false,
    });
    renderWithProviders(<ProfileScreen />);
    expect(screen.getByText('USED BY YOUR CIRCLE')).toBeTruthy();
    expect(screen.getByText('Mira')).toBeTruthy();
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
