import { fireEvent, renderWithProviders, screen } from '@/test/render';
import { WrappedScreen } from './wrapped-screen';

const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: jest.fn(), replace: jest.fn() }),
}));

beforeEach(() => {
  mockBack.mockReset();
});

describe('WrappedScreen', () => {
  it('renders the year label, italic-serif headline, and 4 stats stacked', () => {
    renderWithProviders(<WrappedScreen />);
    expect(screen.getByText('MY 2026')).toBeTruthy();
    expect(screen.getByText('I really\nmoved this year.')).toBeTruthy();
    expect(screen.getByText('cities')).toBeTruthy();
    expect(screen.getByText('places logged')).toBeTruthy();
    expect(screen.getByText('tips')).toBeTruthy();
    expect(screen.getByText('used by friends')).toBeTruthy();
  });

  it('renders the most-stolen-tips grid with used-N×-chips', () => {
    renderWithProviders(<WrappedScreen />);
    expect(screen.getByText('MOST STOLEN TIPS')).toBeTruthy();
    expect(screen.getByText('used 12×')).toBeTruthy();
    expect(screen.getByText('used 9×')).toBeTruthy();
  });

  it('Close calls router.back', () => {
    renderWithProviders(<WrappedScreen />);
    fireEvent.press(screen.getByLabelText('Close'));
    expect(mockBack).toHaveBeenCalled();
  });
});
