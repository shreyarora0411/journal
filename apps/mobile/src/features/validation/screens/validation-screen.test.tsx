import { fireEvent, renderWithProviders, screen } from '@/test/render';
import { ValidationScreen } from './validation-screen';

const mockBack = jest.fn();
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, replace: mockReplace, push: jest.fn() }),
}));

beforeEach(() => {
  mockBack.mockReset();
  mockReplace.mockReset();
});

describe('ValidationScreen', () => {
  it('renders the pink eyebrow, headline, friend card, and stat row', () => {
    renderWithProviders(<ValidationScreen />);
    expect(screen.getByText('JUST NOW ✦')).toBeTruthy();
    expect(screen.getAllByText(/used your/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Tara')).toBeTruthy();
    expect(screen.getByText('Stayed 2 nights in Nihonbashi · Mar 18–20')).toBeTruthy();
    // Two stat values
    expect(screen.getByText('+1')).toBeTruthy();
    expect(screen.getByText('12')).toBeTruthy();
  });

  it('tapping Say hi calls router.back', () => {
    renderWithProviders(<ValidationScreen />);
    fireEvent.press(screen.getByLabelText('Say hi to Tara'));
    expect(mockBack).toHaveBeenCalled();
  });

  it('tapping See my impact routes to /(tabs)/you', () => {
    renderWithProviders(<ValidationScreen />);
    fireEvent.press(screen.getByLabelText('See my impact'));
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)/you');
  });
});
