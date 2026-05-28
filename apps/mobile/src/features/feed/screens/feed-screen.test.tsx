import { renderWithProviders, screen } from '@/test/render';
import { FeedScreen } from './feed-screen';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
  Link: ({ children }: { children: React.ReactNode }) => children,
}));

const mockUseFeed = jest.fn();
jest.mock('@/features/feed', () => {
  const actual = jest.requireActual('@/features/feed');
  return {
    ...actual,
    useFeed: () => mockUseFeed(),
    FeedScreen: actual.FeedScreen,
  };
});

const mockAtomicLogFeed = jest.fn();
const mockMyAtomicLogs = jest.fn();
jest.mock('@/features/trips', () => ({
  useAtomicLogFeed: () => mockAtomicLogFeed(),
  useMyAtomicLogs: () => mockMyAtomicLogs(),
}));

beforeEach(() => {
  mockPush.mockReset();
  mockUseFeed.mockReset();
  mockUseFeed.mockReturnValue({
    data: { pages: [{ rows: [], nextCursor: null }] },
    isLoading: false,
  });
  mockAtomicLogFeed.mockReset();
  mockMyAtomicLogs.mockReset();
  mockAtomicLogFeed.mockReturnValue({ data: [], isLoading: false });
  mockMyAtomicLogs.mockReturnValue({ data: [], isLoading: false });
});

describe('FeedScreen', () => {
  it('renders the wordmark + empty state for a new user with no rows', () => {
    renderWithProviders(<FeedScreen />);
    expect(screen.getByLabelText('lore.')).toBeTruthy();
    expect(screen.getByText('Quiet here.')).toBeTruthy();
    expect(screen.getByLabelText('Log your first tip')).toBeTruthy();
  });

  it('does NOT render the "Right now" live-status strip', () => {
    renderWithProviders(<FeedScreen />);
    expect(screen.queryByText('RIGHT NOW')).toBeNull();
  });

  it('does NOT render fake heart counts or fixture friend cards', () => {
    renderWithProviders(<FeedScreen />);
    expect(screen.queryByText('12')).toBeNull();
    expect(screen.queryByText('28')).toBeNull();
    expect(screen.queryByText('Hotel K5')).toBeNull();
    expect(screen.queryByText('Cervejaria Ramiro')).toBeNull();
  });

  it('renders a friend trip card when useFeed returns rows', () => {
    mockUseFeed.mockReturnValue({
      data: {
        pages: [
          {
            rows: [
              {
                id: 'trip-1',
                user_id: 'user-tara',
                title: 'Tokyo, October',
                start_date: null,
                end_date: null,
                note: 'Walked the river at sunset.',
                cover_photo_id: null,
                visibility: 'friends_of_friends',
                imported_from: null,
                created_at: '2026-01-15T10:00:00Z',
                updated_at: '2026-01-15T10:00:00Z',
                deleted_at: null,
                author: { id: 'user-tara', display_name: 'Tara', handle: 'tara', avatar_url: null },
                cover_photo_path: null,
                love_count: 0,
              },
            ],
            nextCursor: null,
          },
        ],
      },
      isLoading: false,
    });
    renderWithProviders(<FeedScreen />);
    expect(screen.getByText('Tokyo, October')).toBeTruthy();
    expect(screen.getByText('Tara')).toBeTruthy();
    expect(screen.getByText('Walked the river at sunset.')).toBeTruthy();
    expect(screen.getByText('TRIPS FROM MY CIRCLE')).toBeTruthy();
  });
});
