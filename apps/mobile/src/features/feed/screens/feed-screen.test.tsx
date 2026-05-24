import { renderWithProviders, screen } from '@/test/render';
import { FeedScreen } from './feed-screen';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
  Link: ({ children }: { children: React.ReactNode }) => children,
}));

beforeEach(() => {
  mockPush.mockReset();
});

describe('FeedScreen', () => {
  it('renders the wordmark and the Fresh-from-my-circle list', () => {
    renderWithProviders(<FeedScreen />);
    expect(screen.getByLabelText('lore.')).toBeTruthy();
    expect(screen.getByText('FRESH FROM MY CIRCLE')).toBeTruthy();
  });

  it('does NOT render the "Right now" live-status strip (Session 2 — cut)', () => {
    // The live badges were fake; we cut the entire strip until a real
    // current_trip system ships.
    renderWithProviders(<FeedScreen />);
    expect(screen.queryByText('RIGHT NOW')).toBeNull();
    expect(screen.queryByLabelText('Tara is in Tokyo, day 3')).toBeNull();
  });

  it('every rec card leads with the friend, not the place (rule 1)', () => {
    renderWithProviders(<FeedScreen />);
    expect(screen.getByLabelText("Kabir's rec for Hotel K5")).toBeTruthy();
    expect(screen.getByLabelText("Tara's rec for Cervejaria Ramiro")).toBeTruthy();
  });

  it('does NOT render fake heart counts on rec cards (Session 2 — cut)', () => {
    // Fixture hearts were hardcoded. Real love counts come from the
    // trip_with_verdict_counts view and are only shown when > 0.
    renderWithProviders(<FeedScreen />);
    expect(screen.queryByText('12')).toBeNull(); // Kabir's fixture count
    expect(screen.queryByText('28')).toBeNull(); // Tara's fixture count
  });
});
