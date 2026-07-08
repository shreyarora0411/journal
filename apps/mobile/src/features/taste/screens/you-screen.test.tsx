import { fireEvent, renderWithProviders, screen } from '@/test/render';
import { YouScreen } from './you-screen';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
  Link: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('expo-image-picker', () => ({
  MediaTypeOptions: { Images: 'Images' },
  requestMediaLibraryPermissionsAsync: jest.fn(async () => ({ granted: true })),
  launchImageLibraryAsync: jest.fn(async () => ({ canceled: true })),
}));

const mockProfile = jest.fn();
const mockUpdateProfile = jest.fn();
const mockUploadAvatar = jest.fn();
const mockSignOut = jest.fn();
jest.mock('@/features/auth', () => ({
  useAuthStore: <T,>(selector: (s: { session: { user: { id: string } } | null }) => T) =>
    selector({ session: { user: { id: 'user-self' } } }),
  useProfile: () => mockProfile(),
  useUpdateProfile: () => ({
    mutate: mockUpdateProfile,
    mutateAsync: mockUpdateProfile,
    isPending: false,
  }),
  useUploadAvatar: () => ({ mutateAsync: mockUploadAvatar, isPending: false }),
  useSignOut: () => ({ mutateAsync: mockSignOut, isPending: false }),
}));

const mockReachCounts = jest.fn();
jest.mock('@/features/follows', () => ({
  useReachCounts: () => mockReachCounts(),
}));

const mockLists = jest.fn();
const mockDeleteList = jest.fn();
jest.mock('@/features/lists', () => ({
  useMyLists: () => mockLists(),
  useDeleteList: () => ({ mutateAsync: mockDeleteList, isPending: false }),
}));

jest.mock('@/features/invite', () => ({
  buildPersonalInviteText: () => 'invite text',
  buildWhatsAppLink: () => 'https://wa.me/?text=invite%20text',
}));

const mockToastShow = jest.fn();
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ show: mockToastShow }),
  ToastContext: { Provider: ({ children }: { children: React.ReactNode }) => children },
}));

const mockMyTaste = jest.fn();
const mockMyPlaces = jest.fn();
const mockNoteReach = jest.fn();
jest.mock('../api/use-taste-data', () => ({
  useMyTaste: () => mockMyTaste(),
  useMyPlaces: () => mockMyPlaces(),
  useNoteReach: () => mockNoteReach(),
}));

const place = (over: Partial<Record<string, unknown>> = {}) => ({
  sentiment: 'loved',
  updated_at: '2026-07-01T10:00:00Z',
  note: null,
  place: {
    id: 'place-1',
    name: 'Anardana',
    hub: 'm3m_ifc',
    zone: 'gurgaon',
    category: 'restaurant',
    google_place_id: 'g-1',
  },
  ...over,
});

beforeEach(() => {
  mockPush.mockReset();
  mockProfile.mockReset();
  mockReachCounts.mockReset();
  mockLists.mockReset();
  mockMyTaste.mockReset();
  mockMyPlaces.mockReset();
  mockNoteReach.mockReset();

  mockProfile.mockReturnValue({
    data: {
      id: 'user-self',
      handle: 'shrey',
      display_name: 'Shrey',
      avatar_url: null,
      bio: null,
      default_visibility: 'friends_of_friends',
      onboarding_completed_at: '2026-06-01T00:00:00Z',
      home_city: null,
      home_lat: null,
      home_lng: null,
      home_country_code: null,
    },
    isLoading: false,
    isError: false,
  });
  mockUpdateProfile.mockReset();
  mockUploadAvatar.mockReset();
  mockSignOut.mockReset();
  mockReachCounts.mockReturnValue({ data: { borrowers: 4, following: 9 }, isLoading: false });
  mockLists.mockReturnValue({ data: [], isLoading: false });
  mockMyTaste.mockReturnValue({
    data: { axes: {}, readout: ['substance-first', 'late-night-leaning'] },
    isLoading: false,
    isError: false,
    refetch: jest.fn(),
  });
  mockMyPlaces.mockReturnValue({
    data: [place()],
    isLoading: false,
    isError: false,
    refetch: jest.fn(),
  });
  mockNoteReach.mockReturnValue({ data: [], isLoading: false, isError: false, refetch: jest.fn() });
});

describe('YouScreen', () => {
  it('renders the derived taste readout', () => {
    renderWithProviders(<YouScreen />);
    expect(screen.getByText('substance-first · late-night-leaning.')).toBeTruthy();
  });

  it('renders the borrow-count reach line', () => {
    renderWithProviders(<YouScreen />);
    expect(screen.getByText('4 people borrowing your map')).toBeTruthy();
    expect(screen.getByText('Following 9 maps')).toBeTruthy();
  });

  it('tapping the identity card opens the viewer own person map', () => {
    renderWithProviders(<YouScreen />);
    fireEvent.press(screen.getByLabelText('See your map as others do'));
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/person/user-self');
  });

  it('stays silent on the payoff card when nobody has used a noted place yet', () => {
    renderWithProviders(<YouScreen />);
    expect(screen.queryByText(/Your words are getting used/)).toBeNull();
  });

  it('surfaces the payoff card with an honest, non-causal line once someone acts on a noted place', () => {
    mockNoteReach.mockReturnValue({
      data: [
        {
          place_id: 'p1',
          place_name: 'Anardana',
          maps_opens: 2,
          shares: 1,
          last_used_at: '2026-07-01',
        },
        {
          place_id: 'p2',
          place_name: 'Comorin',
          maps_opens: 1,
          shares: 0,
          last_used_at: '2026-06-20',
        },
      ],
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    });
    renderWithProviders(<YouScreen />);
    expect(
      screen.getByText(
        "Your words are getting used — 3 map opens and 1 share on places you've written about.",
      ),
    ).toBeTruthy();
    expect(screen.getByText('Most recently: Anardana')).toBeTruthy();
    // Never claims causation — no "because of your note" / "thanks to you" wording.
    expect(screen.queryByText(/because of your note/i)).toBeNull();
  });

  it('shows a retry affordance if the payoff query fails, without hiding the rest of the screen', () => {
    mockNoteReach.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: jest.fn(),
    });
    renderWithProviders(<YouScreen />);
    expect(screen.getByText("Couldn't check where your words traveled.")).toBeTruthy();
    expect(screen.getByText('4 people borrowing your map')).toBeTruthy();
  });
});
