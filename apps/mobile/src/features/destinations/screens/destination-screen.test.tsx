import { fireEvent, renderWithProviders, screen } from '@/test/render';
import { DestinationScreen } from './destination-screen';

const mockBack = jest.fn();
const mockPush = jest.fn();
const mockSlug = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: mockPush, replace: jest.fn() }),
  useLocalSearchParams: () => ({ slug: mockSlug() }),
  Link: ({ children }: { children: React.ReactNode }) => children,
}));

beforeEach(() => {
  mockBack.mockReset();
  mockPush.mockReset();
  mockSlug.mockReset();
});

describe('DestinationScreen', () => {
  it('renders the title, country, and relational context line for Tokyo', () => {
    mockSlug.mockReturnValue('tokyo');
    renderWithProviders(<DestinationScreen />);
    expect(screen.getByText('Tokyo')).toBeTruthy();
    expect(screen.getByText('Japan')).toBeTruthy();
    expect(screen.getByText(/Tara is here now/)).toBeTruthy();
  });

  it('renders the filter pill row including "All N" and category counts', () => {
    mockSlug.mockReturnValue('tokyo');
    renderWithProviders(<DestinationScreen />);
    // The fixture has one stay rec in Tokyo
    expect(screen.getByLabelText(/All 1/)).toBeTruthy();
    expect(screen.getByLabelText(/Stay 1/)).toBeTruthy();
  });

  it('shows "Destination not found" when the slug does not resolve', () => {
    mockSlug.mockReturnValue('atlantis');
    renderWithProviders(<DestinationScreen />);
    expect(screen.getByText('Destination not found.')).toBeTruthy();
  });

  it('tapping Back calls router.back', () => {
    mockSlug.mockReturnValue('tokyo');
    renderWithProviders(<DestinationScreen />);
    fireEvent.press(screen.getByLabelText('Back'));
    expect(mockBack).toHaveBeenCalled();
  });
});
