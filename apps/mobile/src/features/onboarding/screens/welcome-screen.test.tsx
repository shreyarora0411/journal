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
  it('renders the wordmark, eyebrow, headline and sub-copy', () => {
    renderWithProviders(<WelcomeScreen />);
    expect(screen.getByLabelText('lore.')).toBeTruthy();
    expect(screen.getByText('JUST MY CIRCLE. NO ONE ELSE.')).toBeTruthy();
    expect(screen.getByText('A travel book\nmy friends\nwrite with me.')).toBeTruthy();
    expect(screen.getByText(/No more WhatsApp scavenger hunts/)).toBeTruthy();
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

  it('renders a full-bleed hero image', () => {
    renderWithProviders(<WelcomeScreen />);
    expect(screen.getByTestId('welcome-hero')).toBeTruthy();
  });
});
