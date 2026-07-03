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

const mockVouches = jest.fn();
const mockVouchUses = jest.fn();
const mockUpdateVouch = jest.fn();
const mockDeleteVouch = jest.fn();
jest.mock('@/features/trips', () => ({
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

const mockFollowCounts = jest.fn();
jest.mock('@/features/follows', () => ({
  useFollowCounts: () => mockFollowCounts(),
}));

const mockToastShow = jest.fn();
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ show: mockToastShow }),
  ToastContext: { Provider: ({ children }: { children: React.ReactNode }) => children },
}));

const vouch = (over: Partial<Record<string, unknown>> = {}) => ({
  id: 'vouch-1',
  text: 'The corner table at Olive is the only one to book.',
  vouch_type: 'eat_drink',
  destination_text: 'Goa',
  created_at: '2026-01-15T10:00:00Z',
  ...over,
});

beforeEach(() => {
  mockPush.mockReset();
  mockSignOut.mockReset();
  mockProfile.mockReset();
  mockVouches.mockReset();
  mockVouchUses.mockReset();
  mockLists.mockReset();
  mockWishlist.mockReset();
  mockVouchUses.mockReturnValue({ data: [], isLoading: false });
  mockProfile.mockReturnValue({
    data: { display_name: 'Shrey', handle: 'shrey', avatar_url: null },
    isLoading: false,
  });
  mockVouches.mockReturnValue({ data: [], isLoading: false });
  mockLists.mockReturnValue({ data: [], isLoading: false });
  mockWishlist.mockReturnValue({ data: [], isLoading: false });
  mockFollowCounts.mockReturnValue({ data: { followers: 0, following: 0 }, isLoading: false });
});

describe('ProfileScreen', () => {
  it('renders the identity header (name + handle)', () => {
    renderWithProviders(<ProfileScreen />);
    expect(screen.getByText('Shrey')).toBeTruthy();
    expect(screen.getByText('@shrey')).toBeTruthy();
  });

  it('shows the travel-style prompt when the user has no vouches', () => {
    renderWithProviders(<ProfileScreen />);
    expect(screen.getByText('TRAVEL STYLE')).toBeTruthy();
    expect(screen.getByText(/your travel style takes shape/)).toBeTruthy();
  });

  it("derives a travel-style signature from the user's vouches", () => {
    mockVouches.mockReturnValue({ data: [vouch()], isLoading: false });
    renderWithProviders(<ProfileScreen />);
    expect(screen.getByText('TRAVEL STYLE')).toBeTruthy();
    expect(screen.getByText('Food in Goa.')).toBeTruthy();
  });

  it('never renders the Wrapped teaser — the /wrapped screen shows fabricated fixture stats', () => {
    renderWithProviders(<ProfileScreen />);
    expect(screen.queryByLabelText('Open my Wrapped')).toBeNull();
  });

  it('shows the empty prompt for "Your vouches" when there are none', () => {
    renderWithProviders(<ProfileScreen />);
    expect(screen.getByText('YOUR VOUCHES')).toBeTruthy();
    expect(screen.getByText(/your vouch shows up here/)).toBeTruthy();
  });

  it('shows owner Edit/Delete affordances on each of the viewer own vouches', () => {
    mockVouches.mockReturnValue({ data: [vouch()], isLoading: false });
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
});
