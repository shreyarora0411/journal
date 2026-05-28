import { fireEvent, renderWithProviders, screen } from '@/test/render';
import { SearchScreen } from './search-screen';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
  Link: ({ children }: { children: React.ReactNode }) => children,
}));

const mockUseSearch = jest.fn();
jest.mock('@/features/search', () => ({
  useSearch: () => mockUseSearch(),
}));

beforeEach(() => {
  mockPush.mockReset();
  mockUseSearch.mockReset();
  mockUseSearch.mockReturnValue({ data: [], isLoading: false });
});

describe('SearchScreen', () => {
  it('renders the headline + empty hint when the query is short', () => {
    renderWithProviders(<SearchScreen />);
    expect(screen.getByText('Where are you going?')).toBeTruthy();
    expect(screen.getByLabelText('Search destinations')).toBeTruthy();
    expect(screen.getByText(/Search a city or a venue/)).toBeTruthy();
  });

  it('does NOT render the old fixture destinations or HOT badges', () => {
    renderWithProviders(<SearchScreen />);
    expect(screen.queryByText('FRIENDS I TRUST')).toBeNull();
    expect(screen.queryByText('Tokyo')).toBeNull();
    expect(screen.queryByText('Lisbon')).toBeNull();
    expect(screen.queryByText('Pondicherry')).toBeNull();
    expect(screen.queryByText('Pokhara')).toBeNull();
    expect(screen.queryAllByText('HOT').length).toBe(0);
  });

  it('shows a no-results empty card after a real query returns nothing', () => {
    renderWithProviders(<SearchScreen />);
    fireEvent.changeText(screen.getByLabelText('Search destinations'), 'tokyo');
    expect(screen.getByText('Nothing in your circle yet.')).toBeTruthy();
  });

  it('renders rows when useSearch returns results', () => {
    mockUseSearch.mockReturnValue({
      data: [
        {
          kind: 'city',
          id: 'city-1',
          trip_id: 'trip-1',
          trip_title: "Tara's October trip",
          trip_user_id: 'user-tara',
          name: 'Tokyo',
          country_name: 'Japan',
          quote: null,
          rank: 1,
          created_at: '2026-01-01',
        },
      ],
      isLoading: false,
    });
    renderWithProviders(<SearchScreen />);
    fireEvent.changeText(screen.getByLabelText('Search destinations'), 'tokyo');
    expect(screen.getByText('Tokyo')).toBeTruthy();
    expect(screen.getByText(/CITY · Japan/)).toBeTruthy();
  });
});
