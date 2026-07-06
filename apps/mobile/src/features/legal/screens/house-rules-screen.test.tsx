import { fireEvent, renderWithProviders, screen } from '@/test/render';
import { HouseRulesScreen } from './house-rules-screen';

const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: jest.fn(), replace: jest.fn() }),
}));

beforeEach(() => {
  mockBack.mockReset();
});

describe('HouseRulesScreen', () => {
  it('renders the title and the three house rules', () => {
    renderWithProviders(<HouseRulesScreen />);
    expect(screen.getByText('House rules')).toBeTruthy();
    expect(screen.getByText(/Read it like a friend/i)).toBeTruthy();
    expect(screen.getByText(/Log honestly/i)).toBeTruthy();
    expect(screen.getByText(/Share what helps/i)).toBeTruthy();
  });

  it('renders a back button that calls router.back when pressed', () => {
    renderWithProviders(<HouseRulesScreen />);
    fireEvent.press(screen.getByLabelText('Back'));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});
