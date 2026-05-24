import { fireEvent, renderWithProviders, screen } from '@/test/render';
import { SearchScreen } from './search-screen';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
  Link: ({ children }: { children: React.ReactNode }) => children,
}));

beforeEach(() => {
  mockPush.mockReset();
});

describe('SearchScreen', () => {
  it('renders the headline, search input, hero card, and Friends I trust list', () => {
    renderWithProviders(<SearchScreen />);
    expect(screen.getByText('Where are you going?')).toBeTruthy();
    expect(screen.getByLabelText('Search destinations')).toBeTruthy();
    expect(screen.getByLabelText('Because Tara just got back — Tokyo')).toBeTruthy();
    expect(screen.getByText('FRIENDS I TRUST')).toBeTruthy();
  });

  it('shows the four destinations from the fixture', () => {
    renderWithProviders(<SearchScreen />);
    expect(screen.getByLabelText('Tokyo')).toBeTruthy();
    expect(screen.getByLabelText('Lisbon')).toBeTruthy();
    expect(screen.getByLabelText('Pondicherry')).toBeTruthy();
    expect(screen.getByLabelText('Pokhara')).toBeTruthy();
  });

  it('renders a HOT badge on hot destinations', () => {
    renderWithProviders(<SearchScreen />);
    // Two destinations are flagged hot in the fixture
    expect(screen.getAllByText('HOT').length).toBeGreaterThanOrEqual(2);
  });

  it('tapping a destination row routes to /destination/<slug>', () => {
    renderWithProviders(<SearchScreen />);
    fireEvent.press(screen.getByLabelText('Lisbon'));
    expect(mockPush).toHaveBeenCalledWith('/destination/lisbon');
  });
});
