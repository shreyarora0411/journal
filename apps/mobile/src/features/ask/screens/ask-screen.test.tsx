import { fireEvent, renderWithProviders, screen, waitFor } from '@/test/render';
import { AskScreen } from './ask-screen';

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack, replace: jest.fn() }),
  useLocalSearchParams: () => ({}),
}));

const mockShow = jest.fn();
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ show: mockShow }),
  ToastContext: { Provider: ({ children }: { children: React.ReactNode }) => children },
}));

const mockCreate = jest.fn();
const mockRespond = jest.fn();
const mockSent = jest.fn();
const mockInbox = jest.fn();
const mockMyVouches = jest.fn();
jest.mock('../api/use-ask', () => ({
  useCreateRequest: () => ({ mutateAsync: mockCreate, isPending: false }),
  useRespondToRequest: () => ({ mutateAsync: mockRespond, isPending: false }),
  useSentRequests: () => mockSent(),
  useInboxRequests: () => mockInbox(),
  useMyVouches: () => mockMyVouches(),
}));

beforeEach(() => {
  mockPush.mockReset();
  mockShow.mockReset();
  mockCreate.mockReset();
  mockRespond.mockReset();
  mockSent.mockReset().mockReturnValue({ data: [] });
  mockInbox.mockReset().mockReturnValue({ data: [] });
  mockMyVouches.mockReset().mockReturnValue({ data: [] });
});

const goaInboxRequest = {
  id: 'req-1',
  requester_user_id: 'u-mira',
  destination_text: 'Goa',
  request_text: 'Quiet beach stay?',
  status: 'open',
  created_at: '2026-06-01T00:00:00Z',
  requester: { display_name: 'Mira', handle: 'mira', avatar_url: null },
};

describe('AskScreen (Loop C)', () => {
  it('renders the compose prompts', () => {
    renderWithProviders(<AskScreen />);
    expect(screen.getByText('Ask your circle.')).toBeTruthy();
    expect(screen.getByText('WHERE TO?')).toBeTruthy();
    expect(screen.getByText('WHAT DO YOU WANT TO KNOW?')).toBeTruthy();
  });

  it('does not send until destination and text are filled', () => {
    renderWithProviders(<AskScreen />);
    fireEvent.press(screen.getByLabelText('Send ask'));
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('creates a request with destination + text', async () => {
    mockCreate.mockResolvedValueOnce({ id: 'r1' });
    renderWithProviders(<AskScreen />);
    fireEvent.changeText(screen.getByLabelText('Ask destination'), 'Spiti');
    fireEvent.changeText(screen.getByLabelText('Ask text'), 'Where to stay for 3 nights?');
    fireEvent.press(screen.getByLabelText('Send ask'));
    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith({
        destinationText: 'Spiti',
        requestText: 'Where to stay for 3 nights?',
      });
    });
  });

  it('answers an incoming ask from the circle inline', async () => {
    mockInbox.mockReturnValue({ data: [goaInboxRequest] });
    mockRespond.mockResolvedValueOnce(undefined);
    renderWithProviders(<AskScreen />);
    expect(screen.getByText('Mira · Goa')).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText('Answer Mira'), 'Stay in Assagao, skip Baga');
    fireEvent.press(screen.getByLabelText('Send answer to Mira'));
    await waitFor(() => {
      expect(mockRespond).toHaveBeenCalledWith({
        requestId: 'req-1',
        text: 'Stay in Assagao, skip Baga',
        vouchId: undefined,
      });
    });
  });

  it('lets the responder attach one of their vouches for that destination', async () => {
    mockInbox.mockReturnValue({ data: [goaInboxRequest] });
    // Stored as "Goa, India" — must still match the request's "Goa" (norm + contains).
    mockMyVouches.mockReturnValue({
      data: [
        {
          id: 'v-1',
          text: 'Vivenda dos Palhaços, Majorda — worth it',
          vouch_type: 'stay',
          destination_text: 'Goa, India',
          created_at: '2026-05-01T00:00:00Z',
        },
      ],
    });
    mockRespond.mockResolvedValueOnce(undefined);
    renderWithProviders(<AskScreen />);

    // Pick the vouch, then send with no free text — vouchId rides along.
    fireEvent.press(
      screen.getByLabelText('Attach vouch: Vivenda dos Palhaços, Majorda — worth it'),
    );
    fireEvent.press(screen.getByLabelText('Send answer to Mira'));
    await waitFor(() => {
      expect(mockRespond).toHaveBeenCalledWith({
        requestId: 'req-1',
        text: undefined,
        vouchId: 'v-1',
      });
    });
  });

  it('hides the vouch picker when none match the destination', () => {
    mockInbox.mockReturnValue({ data: [goaInboxRequest] });
    mockMyVouches.mockReturnValue({
      data: [
        {
          id: 'v-2',
          text: 'Lub d hostel, Koh Samui',
          vouch_type: 'stay',
          destination_text: 'Koh Samui',
          created_at: '2026-05-01T00:00:00Z',
        },
      ],
    });
    renderWithProviders(<AskScreen />);
    expect(screen.queryByText('Attach one of your vouches (optional)')).toBeNull();
  });
});
