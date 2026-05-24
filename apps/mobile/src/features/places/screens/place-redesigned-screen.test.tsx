import { renderWithProviders, screen } from '@/test/render';
import { PlaceRedesignedScreen } from './place-redesigned-screen';

const mockBack = jest.fn();
const mockId = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => ({ id: mockId() }),
}));

beforeEach(() => {
  mockBack.mockReset();
  mockId.mockReset();
});

describe('PlaceRedesignedScreen', () => {
  it('renders the place name, category, area, primary voice, tip card, and CTAs', () => {
    mockId.mockReturnValue('hotel-k5');
    renderWithProviders(<PlaceRedesignedScreen />);
    expect(screen.getByText('Hotel K5')).toBeTruthy();
    expect(screen.getByText('STAY')).toBeTruthy();
    expect(screen.getByText('Nihonbashi, Tokyo · Japan')).toBeTruthy();
    expect(screen.getByText('Kabir')).toBeTruthy();
    expect(screen.getByText('Stayed in March · 4 nights')).toBeTruthy();
    expect(screen.getByText('HIS TIP')).toBeTruthy();
    expect(screen.getByLabelText('Stash for my Tokyo')).toBeTruthy();
    expect(screen.getByLabelText('Open site')).toBeTruthy();
  });

  it('renders the "Who else stayed" section with the two other friends', () => {
    mockId.mockReturnValue('hotel-k5');
    renderWithProviders(<PlaceRedesignedScreen />);
    expect(screen.getByText('WHO ELSE STAYED')).toBeTruthy();
    expect(screen.getByText('Tara')).toBeTruthy();
    expect(screen.getByText('Anya')).toBeTruthy();
  });

  it('shows "Place not found" when the id does not resolve', () => {
    mockId.mockReturnValue('atlantis-suites');
    renderWithProviders(<PlaceRedesignedScreen />);
    expect(screen.getByText('Place not found.')).toBeTruthy();
  });
});
