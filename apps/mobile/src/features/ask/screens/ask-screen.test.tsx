import { fireEvent, renderWithProviders, screen, waitFor } from '@/test/render';
import { AskScreen } from './ask-screen';

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack, replace: jest.fn() }),
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
jest.mock('../api/use-ask', () => ({
  useCreateRequest: () => ({ mutateAsync: mockCreate, isPending: false }),
  useRespondToRequest: () => ({ mutateAsync: mockRespond, isPending: false }),
  useSentRequests: () => mockSent(),
  useInboxRequests: () => mockInbox(),
}));

beforeEach(() => {
  mockPush.mockReset();
  mockShow.mockReset();
  mockCreate.mockReset();
  mockRespond.mockReset();
  mockSent.mockReset().mockReturnValue({ data: [] });
  mockInbox.mockReset().mockReturnValue({ data: [] });
});

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
    mockInbox.mockReturnValue({
      data: [
        {
          id: 'req-1',
          requester_user_id: 'u-mira',
          destination_text: 'Goa',
          request_text: 'Quiet beach stay?',
          status: 'open',
          created_at: '2026-06-01T00:00:00Z',
          requester: { display_name: 'Mira', handle: 'mira', avatar_url: null },
        },
      ],
    });
    mockRespond.mockResolvedValueOnce(undefined);
    renderWithProviders(<AskScreen />);
    expect(screen.getByText('Mira · Goa')).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText('Answer Mira'), 'Stay in Assagao, skip Baga');
    fireEvent.press(screen.getByLabelText('Send answer to Mira'));
    await waitFor(() => {
      expect(mockRespond).toHaveBeenCalledWith({
        requestId: 'req-1',
        text: 'Stay in Assagao, skip Baga',
      });
    });
  });
});
