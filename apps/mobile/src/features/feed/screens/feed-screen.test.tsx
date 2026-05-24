import { fireEvent, renderWithProviders, screen } from '@/test/render';
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
  it('renders the wordmark, Right now strip, and Fresh from my circle list', () => {
    renderWithProviders(<FeedScreen />);
    expect(screen.getByLabelText('lore.')).toBeTruthy();
    expect(screen.getByText('RIGHT NOW')).toBeTruthy();
    expect(screen.getByText('FRESH FROM MY CIRCLE')).toBeTruthy();
  });

  it('renders a live-traveler card with face + destination + day number', () => {
    renderWithProviders(<FeedScreen />);
    // From fixtures: Tara is in Tokyo, day 3
    expect(screen.getByLabelText('Tara is in Tokyo, day 3')).toBeTruthy();
  });

  it('every rec card leads with the friend, not the place (rule 1)', () => {
    renderWithProviders(<FeedScreen />);
    // Each rec card uses accessibilityLabel "<Friend>'s rec for <Place>"
    expect(screen.getByLabelText("Kabir's rec for Hotel K5")).toBeTruthy();
    expect(screen.getByLabelText("Tara's rec for Cervejaria Ramiro")).toBeTruthy();
  });

  it('tapping a live-traveler card routes to /destination/<slug>', () => {
    renderWithProviders(<FeedScreen />);
    fireEvent.press(screen.getByLabelText('Tara is in Tokyo, day 3'));
    expect(mockPush).toHaveBeenCalledWith('/destination/tokyo');
  });
});
