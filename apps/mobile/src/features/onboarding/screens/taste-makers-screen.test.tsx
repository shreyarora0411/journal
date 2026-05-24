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

  it('renders all four taste-maker cards by name', () => {
    renderWithProviders(<TasteMakersScreen />);
    expect(screen.getByText('Tara Chandra')).toBeTruthy();
    expect(screen.getByText('Kabir Mehta')).toBeTruthy();
    expect(screen.getByText('Divyansh Rao')).toBeTruthy();
    expect(screen.getByText('Anya Patel')).toBeTruthy();
  });

  it('toggling Follow updates the CTA copy', () => {
    renderWithProviders(<TasteMakersScreen />);
    expect(screen.getByText('Continue without following anyone')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Follow Tara Chandra'));
    expect(screen.getByText(/Continue · following 1/)).toBeTruthy();
  });

  it('Continue routes to /(auth)/import', () => {
    renderWithProviders(<TasteMakersScreen />);
    fireEvent.press(screen.getByLabelText('Continue'));
    expect(mockReplace).toHaveBeenCalledWith('/(auth)/import');
  });
});
