import { fireEvent, renderWithProviders, screen } from '@/test/render';
import { CircleScreen } from './circle-screen';

const mockReplace = jest.fn();
const mockBack = jest.fn();
let mockSearchParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn(), back: mockBack }),
  useLocalSearchParams: () => mockSearchParams,
}));

const mockShow = jest.fn();
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ show: mockShow }),
  ToastContext: { Provider: ({ children }: { children: React.ReactNode }) => children },
}));

const mockMatchContactsMutate = jest.fn();
const mockMatched = jest.fn();
jest.mock('../api/use-match-contacts', () => ({
  useMatchContacts: () => ({ mutateAsync: mockMatchContactsMutate, isPending: false }),
}));
jest.mock('../api/use-matched-friends', () => ({
  useMatchedFriends: () => mockMatched(),
}));

jest.mock('@/features/follows', () => ({
  useFollow: () => ({ mutateAsync: jest.fn(), isPending: false }),
}));

const mockUpdateProfile = jest.fn();
jest.mock('@/features/auth', () => ({
  useUpdateProfile: () => ({ mutateAsync: mockUpdateProfile, isPending: false }),
}));

beforeEach(() => {
  mockReplace.mockReset();
  mockBack.mockReset();
  mockSearchParams = {};
  mockShow.mockReset();
  mockMatched.mockReset();
  mockMatched.mockReturnValue({ data: [], refetch: jest.fn() });
  mockUpdateProfile.mockReset();
  mockUpdateProfile.mockResolvedValue({});
});

describe('CircleScreen', () => {
  it('renders the step 1 eyebrow, headline, and three connector cards', () => {
    renderWithProviders(<CircleScreen />);
    expect(screen.getByText('STEP 2 OF 2')).toBeTruthy();
    expect(screen.getByText('Bring\nyour circle.')).toBeTruthy();
    expect(screen.getByLabelText('Instagram')).toBeTruthy();
    expect(screen.getByLabelText('Contacts')).toBeTruthy();
    expect(screen.getByLabelText('WhatsApp chat')).toBeTruthy();
  });

  it('tapping the Instagram card toasts coming-soon', () => {
    renderWithProviders(<CircleScreen />);
    fireEvent.press(screen.getByLabelText('Instagram'));
    expect(mockShow).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringMatching(/Instagram.*coming soon/i) }),
    );
  });

  it('renders the matched-friends card when there are matches', () => {
    mockMatched.mockReturnValue({
      data: [
        { id: 'a', display_name: 'Tara', handle: '@tara', avatar_url: null, badge: '', score: 1 },
        { id: 'b', display_name: 'Kabir', handle: '@kbr', avatar_url: null, badge: '', score: 1 },
      ],
      refetch: jest.fn(),
    });
    renderWithProviders(<CircleScreen />);
    // The phrase appears in two places — the Contacts connector subtitle
    // and the matched-friends card. The card-specific affordance is the
    // "Add all N" pill.
    expect(screen.getAllByText('2 friends already on Vouch.').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByLabelText('Add all 2')).toBeTruthy();
  });

  it('Continue stamps onboarding_completed and routes to /(tabs)/book', async () => {
    mockMatched.mockReturnValue({
      data: [
        { id: 'a', display_name: 'Tara', handle: '@tara', avatar_url: null, badge: '', score: 1 },
      ],
      refetch: jest.fn(),
    });
    renderWithProviders(<CircleScreen />);
    fireEvent.press(screen.getByLabelText('Continue'));
    // Wait for the async finish() handler to complete.
    await new Promise((r) => setTimeout(r, 0));
    expect(mockUpdateProfile).toHaveBeenCalledWith(
      expect.objectContaining({ onboarding_completed: true }),
    );
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)/book');
  });

  it('Skip also stamps onboarding_completed and routes to /(tabs)/book', async () => {
    renderWithProviders(<CircleScreen />);
    fireEvent.press(screen.getByLabelText('Skip'));
    await new Promise((r) => setTimeout(r, 0));
    expect(mockUpdateProfile).toHaveBeenCalledWith(
      expect.objectContaining({ onboarding_completed: true }),
    );
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)/book');
  });

  it('in re-entry mode, shows the Find friends eyebrow and does NOT re-stamp onboarding', async () => {
    mockSearchParams = { reentry: '1' };
    renderWithProviders(<CircleScreen />);
    expect(screen.getByText('FIND FRIENDS')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Continue'));
    await new Promise((r) => setTimeout(r, 0));
    // Re-entry must not touch onboarding completion or hard-route to the feed —
    // it just pops back to wherever the user came from.
    expect(mockUpdateProfile).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockBack).toHaveBeenCalled();
  });
});
