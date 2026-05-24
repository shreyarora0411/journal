import { fireEvent, renderWithProviders, screen } from '@/test/render';
import { TasteMakersScreen } from './taste-makers-screen';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn(), back: jest.fn() }),
}));

beforeEach(() => {
  mockReplace.mockReset();
});

describe('TasteMakersScreen', () => {
  it('renders the step 2 eyebrow, fallback eyebrow, and headline', () => {
    renderWithProviders(<TasteMakersScreen />);
    expect(screen.getByText('STEP 2 OF 4')).toBeTruthy();
    expect(screen.getByText("IF YOU DON'T CONNECT ANYTHING")).toBeTruthy();
    expect(screen.getByText('Follow a few\ntaste-makers.')).toBeTruthy();
  });

  it('renders the "Coming soon" holding state instead of stock-photo strangers', () => {
    // Session 2 lock: ship the holding state. TASTE_MAKERS fixture is
    // empty until real curated people land.
    renderWithProviders(<TasteMakersScreen />);
    expect(screen.getByText('Coming soon')).toBeTruthy();
    expect(screen.getByText(/curating a small group of travelers/i)).toBeTruthy();
    // No stock-photo names should appear
    expect(screen.queryByText('Tara Chandra')).toBeNull();
    expect(screen.queryByText('Kabir Mehta')).toBeNull();
  });

  it('CTA label reflects the empty state', () => {
    renderWithProviders(<TasteMakersScreen />);
    // With no taste-makers to follow, the CTA is just "Continue".
    expect(screen.getByText('Continue')).toBeTruthy();
  });

  it('Continue routes to /(auth)/import', () => {
    renderWithProviders(<TasteMakersScreen />);
    fireEvent.press(screen.getByLabelText('Continue'));
    expect(mockReplace).toHaveBeenCalledWith('/(auth)/import');
  });
});
