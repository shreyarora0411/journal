import { fireEvent, renderWithProviders, screen } from '@/test/render';
import { WelcomeScreen } from './welcome-screen';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
}));

beforeEach(() => {
  mockPush.mockReset();
});

describe('WelcomeScreen', () => {
  it('renders the wordmark, sample card deck, eyebrow, and headline', () => {
    renderWithProviders(<WelcomeScreen />);
    expect(screen.getByLabelText('Vouch.')).toBeTruthy();
    expect(screen.getByLabelText('Sample friend quotes')).toBeTruthy();
    expect(screen.getByText('THIS IS THE WHOLE APP')).toBeTruthy();
    expect(screen.getByText(/Places you'll love/)).toBeTruthy();
    expect(screen.getByText(/their map\s?becomes your answers/i)).toBeTruthy();
  });

  it('renders the three sample friend cards', () => {
    renderWithProviders(<WelcomeScreen />);
    expect(screen.getByText('Arjun')).toBeTruthy();
    expect(screen.getByText('Mira')).toBeTruthy();
    expect(screen.getByText('Tara')).toBeTruthy();
  });

  it('tapping Get started routes to /(auth)/login', () => {
    renderWithProviders(<WelcomeScreen />);
    fireEvent.press(screen.getByLabelText('Get started'));
    expect(mockPush).toHaveBeenCalledWith('/(auth)/login');
  });

  it('tapping Sign in also routes to /(auth)/login', () => {
    renderWithProviders(<WelcomeScreen />);
    fireEvent.press(screen.getByLabelText('Sign in'));
    expect(mockPush).toHaveBeenCalledWith('/(auth)/login');
  });
});
