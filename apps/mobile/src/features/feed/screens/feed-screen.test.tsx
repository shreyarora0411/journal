import { renderWithProviders, screen } from '@/test/render';
import { FeedScreen } from './feed-screen';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
  Link: ({ children }: { children: React.ReactNode }) => children,
}));

// useCirclePulse is exported from '@/features/feed' by another agent — it
// isn't in the real barrel yet, so the mock supplies it explicitly (alongside
// the actual FeedScreen under test).
const mockCirclePulse = jest.fn();
jest.mock('@/features/feed', () => {
  const actual = jest.requireActual('@/features/feed');
  return {
    ...actual,
    useCirclePulse: () => mockCirclePulse(),
    FeedScreen: actual.FeedScreen,
  };
});

const mockVouchUses = jest.fn();
const mockMyVouches = jest.fn();
jest.mock('@/features/trips', () => ({
  useVouchUses: () => mockVouchUses(),
  useMyVouches: () => mockMyVouches(),
}));

const mockWishlistRows = jest.fn();
jest.mock('@/features/wishlist', () => ({
  useWishlistRows: () => mockWishlistRows(),
}));

const mockVouchSearch = jest.fn();
const mockRecordInteraction = jest.fn();
const mockLatestSignal = jest.fn();
jest.mock('@/features/search', () => ({
  useVouchSearch: () => mockVouchSearch(),
  useRecordInteraction: () => ({ mutate: mockRecordInteraction }),
  useLatestDestinationSignal: () => mockLatestSignal(),
}));

const mockVouchFeed = jest.fn();
jest.mock('../api/use-vouch-feed', () => ({
  useVouchFeed: () => mockVouchFeed(),
}));

beforeEach(() => {
  mockPush.mockReset();
  mockVouchUses.mockReset();
  mockMyVouches.mockReset();
  mockWishlistRows.mockReset();
  mockVouchSearch.mockReset();
  mockVouchFeed.mockReset();
  mockCirclePulse.mockReset();
  mockRecordInteraction.mockReset();
  mockLatestSignal.mockReset();
  // Default: no private search signal — resurfacing falls back to wishlist.
  mockLatestSignal.mockReturnValue({ data: null, isLoading: false });

  // Default: a brand-new user — every section empty.
  mockVouchUses.mockReturnValue({ data: [], isLoading: false });
  mockMyVouches.mockReturnValue({ data: [], isLoading: false });
  mockWishlistRows.mockReturnValue({ data: [], isLoading: false });
  mockVouchSearch.mockReturnValue({ data: [], isLoading: false });
  mockVouchFeed.mockReturnValue({ data: [], isLoading: false });
  mockCirclePulse.mockReturnValue({ data: { newThisWeek: 0, myVouchCount: 0, topCity: null } });
});

describe('FeedScreen', () => {
  it('renders the wordmark + two-step activation for a new user with no rows', () => {
    renderWithProviders(<FeedScreen />);
    expect(screen.getByLabelText('Vouch.')).toBeTruthy();
    expect(screen.getByText('Start your circle.')).toBeTruthy();
    // Two-step activation: log a place, then invite the circle.
    expect(screen.getByLabelText('Log one place')).toBeTruthy();
    expect(screen.getByLabelText('Invite your circle')).toBeTruthy();
  });

  it('does NOT render the removed filter pills or trips carousel', () => {
    // The home is an intent desk now — search lives in Search, and the
    // Instagram-shaped trips carousel is gone.
    mockVouchFeed.mockReturnValue({
      data: [
        {
          id: 'v-1',
          text: 'Order the hand drip',
          vouch_type: 'eat_drink',
          destination_text: 'Tokyo',
          author: { display_name: 'Tara', handle: 'tara', avatar_url: null },
        },
      ],
      isLoading: false,
    });
    renderWithProviders(<FeedScreen />);
    expect(screen.queryByLabelText('Filter: Eat / Drink')).toBeNull();
    expect(screen.queryByText('Trips from your circle')).toBeNull();
  });

  it('renders the payoff banner when someone saved my vouch', () => {
    mockVouchUses.mockReturnValue({
      data: [
        {
          vouch_id: 'vouch-1',
          vouch_text: 'Order the hand drip at the back counter',
          vouch_type: 'eat_drink',
          destination_text: 'Tokyo',
          saver_id: 'user-mira',
          saver_name: 'Mira',
          saver_handle: 'mira',
          saver_avatar: null,
          saved_at: '2026-06-20T10:00:00Z',
        },
      ],
      isLoading: false,
    });
    renderWithProviders(<FeedScreen />);
    expect(screen.getByText('Mira')).toBeTruthy();
    // Voice-forward, truncated to ~40 chars with an ellipsis — no counts.
    expect(screen.getByText(/saved your/)).toBeTruthy();
  });

  it('uses the most recent vouched destination in the supply CTA (non-asserting)', () => {
    mockMyVouches.mockReturnValue({
      data: [
        {
          id: 'm-1',
          text: 'Stay lakeside',
          vouch_type: 'stay',
          destination_text: 'Udaipur',
          created_at: '2026-06-01T00:00:00Z',
        },
      ],
      isLoading: false,
    });
    // Give the home some content so it's past the empty state.
    mockVouchFeed.mockReturnValue({
      data: [
        {
          id: 'v-1',
          text: 'Order the hand drip',
          vouch_type: 'eat_drink',
          destination_text: 'Tokyo',
          author: { display_name: 'Tara', handle: 'tara', avatar_url: null },
        },
      ],
      isLoading: false,
    });
    renderWithProviders(<FeedScreen />);
    expect(screen.getByText('More from Udaipur?')).toBeTruthy();
  });

  it('renders the resurfacing card for the first saved destination when no search signal', () => {
    mockWishlistRows.mockReturnValue({
      data: [
        {
          id: 'w-1',
          parent_wishlist_item_id: null,
          target_external_id: 'ext-1',
          target_label: 'Lisbon',
        },
      ],
      isLoading: false,
    });
    mockVouchSearch.mockReturnValue({
      data: [
        {
          vouch_id: 'sv-1',
          list_id: null,
          list_title: null,
          vouch_text: 'Cervejaria Ramiro for the prawns',
          vouch_type: 'eat_drink',
          destination_text: 'Lisbon',
          author_id: 'user-ben',
          author_name: 'Ben',
          author_handle: 'ben',
          author_avatar: null,
          is_own: false,
          is_trusted: true,
          context_match: false,
          score: 1,
          created_at: '2026-05-01T00:00:00Z',
          is_fof: false,
          place_google_id: null,
          place_lat: null,
          place_lng: null,
          place_name: null,
        },
      ],
      isLoading: false,
    });
    renderWithProviders(<FeedScreen />);
    expect(screen.getByText('Lisbon — your circle’s picks')).toBeTruthy();
    expect(screen.getByText('"Cervejaria Ramiro for the prawns"')).toBeTruthy();
    expect(screen.getByText('See all ›')).toBeTruthy();
  });

  it('resurfaces the destination the viewer SEARCHED (private signal), over a saved one', () => {
    // The honest forward signal: a real in-app search, not a wishlist heuristic.
    mockLatestSignal.mockReturnValue({
      data: {
        destination_text: 'Kyoto',
        norm_destination: 'kyoto',
        search_count: 2,
        last_searched_at: '2026-06-25T00:00:00Z',
      },
      isLoading: false,
    });
    // A stale saved destination that must NOT win over the live search signal.
    mockWishlistRows.mockReturnValue({
      data: [
        {
          id: 'w-1',
          parent_wishlist_item_id: null,
          target_external_id: 'x',
          target_label: 'Lisbon',
        },
      ],
      isLoading: false,
    });
    mockVouchSearch.mockReturnValue({
      data: [
        {
          vouch_id: 'sv-2',
          list_id: null,
          list_title: null,
          vouch_text: 'Kissa Master for the kissaten set',
          vouch_type: 'eat_drink',
          destination_text: 'Kyoto',
          author_id: 'user-rhea',
          author_name: 'Rhea',
          author_handle: 'rhea',
          author_avatar: null,
          is_own: false,
          is_trusted: true,
          context_match: false,
          score: 1,
          created_at: '2026-05-01T00:00:00Z',
          is_fof: false,
          place_google_id: null,
          place_lat: null,
          place_lng: null,
          place_name: null,
        },
      ],
      isLoading: false,
    });
    renderWithProviders(<FeedScreen />);
    expect(screen.getByText('Kyoto — your circle’s picks')).toBeTruthy();
    expect(screen.queryByText('Lisbon — your circle’s picks')).toBeNull();
  });

  it('renders the liveness line and belonging nudge from circle pulse', () => {
    mockCirclePulse.mockReturnValue({ data: { newThisWeek: 3, myVouchCount: 8, topCity: 'Goa' } });
    mockVouchFeed.mockReturnValue({
      data: [
        {
          id: 'v-1',
          text: 'Order the hand drip',
          vouch_type: 'eat_drink',
          destination_text: 'Tokyo',
          author: { display_name: 'Tara', handle: 'tara', avatar_url: null },
        },
      ],
      isLoading: false,
    });
    renderWithProviders(<FeedScreen />);
    expect(screen.getByText('3 new vouches from your circle this week.')).toBeTruthy();
    expect(
      screen.getByText('You’ve left 8 vouches — your circle leans on you for Goa.'),
    ).toBeTruthy();
  });

  it('renders the demoted Lately feed with a vouch card', () => {
    mockVouchFeed.mockReturnValue({
      data: [
        {
          id: 'v-1',
          text: 'Order the hand drip',
          vouch_type: 'eat_drink',
          destination_text: 'Tokyo',
          author: { display_name: 'Tara', handle: 'tara', avatar_url: null },
        },
      ],
      isLoading: false,
    });
    renderWithProviders(<FeedScreen />);
    expect(screen.getByText('Lately from your circle')).toBeTruthy();
    expect(screen.getByText('"Order the hand drip"')).toBeTruthy();
    expect(screen.getByText('Tara')).toBeTruthy();
  });
});
