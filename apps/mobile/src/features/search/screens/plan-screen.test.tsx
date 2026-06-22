import { fireEvent, renderWithProviders, screen, waitFor } from '@/test/render';
import { PlanScreen } from './plan-screen';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
}));

const mockSearch = jest.fn();
jest.mock('../api/use-vouch-search', () => ({
  // vouchReason is a pure helper — use the real implementation.
  ...jest.requireActual('../api/use-vouch-search'),
  useVouchSearch: () => mockSearch(),
}));

beforeEach(() => {
  mockPush.mockReset();
  mockSearch.mockReset();
  mockSearch.mockReturnValue({ data: [], isLoading: false });
});

const row = (over: Partial<Record<string, unknown>> = {}) => ({
  vouch_id: 'v1',
  trip_id: 't1',
  vouch_text: 'Banjara, book the tents',
  vouch_type: 'stay',
  destination_text: 'Spiti',
  author_id: 'u-rhea',
  author_name: 'Rhea',
  author_handle: 'rhea',
  author_avatar: null,
  trip_title: 'Spiti in June',
  trip_verdict: 'love',
  is_own: false,
  is_trusted: true,
  context_match: false,
  score: 0.9,
  created_at: '2026-05-01T00:00:00Z',
  ...over,
});

describe('PlanScreen (Loop B trust-led search)', () => {
  it('shows the intro hint before a destination is entered', () => {
    renderWithProviders(<PlanScreen />);
    expect(screen.getByText(/what your circle vouched for/i)).toBeTruthy();
  });

  it('renders ranked vouches grouped under the source person, in their words', async () => {
    mockSearch.mockReturnValue({ data: [row()], isLoading: false });
    renderWithProviders(<PlanScreen />);
    fireEvent.changeText(screen.getByLabelText('Destination'), 'Spiti');
    await waitFor(() => {
      expect(screen.getByText('Rhea')).toBeTruthy();
      expect(screen.getByText('"Banjara, book the tents"')).toBeTruthy();
      // Human-readable reason, never a score.
      expect(screen.getByText('Rhea vouched from Spiti in June')).toBeTruthy();
    });
  });

  it('offers Ask-your-circle when the circle has nothing for the destination', async () => {
    mockSearch.mockReturnValue({ data: [], isLoading: false });
    renderWithProviders(<PlanScreen />);
    fireEvent.changeText(screen.getByLabelText('Destination'), 'Reykjavik');
    await waitFor(() => {
      expect(screen.getByText(/Nothing from your circle yet/)).toBeTruthy();
      expect(screen.getByLabelText('Ask your circle')).toBeTruthy();
    });
  });

  it('surfaces a context-trust reason when the viewer trusts the source for that category', async () => {
    mockSearch.mockReturnValue({
      data: [row({ context_match: true, vouch_type: 'stay' })],
      isLoading: false,
    });
    renderWithProviders(<PlanScreen />);
    fireEvent.changeText(screen.getByLabelText('Destination'), 'Spiti');
    await waitFor(() => {
      expect(screen.getByText('You trust Rhea for stays')).toBeTruthy();
    });
  });
});
