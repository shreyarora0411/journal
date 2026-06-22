import { fireEvent, renderWithProviders, screen, waitFor } from '@/test/render';
import { TripComposerScreen } from './trip-composer-screen';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn(), back: jest.fn() }),
}));

const mockShow = jest.fn();
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ show: mockShow }),
  ToastContext: { Provider: ({ children }: { children: React.ReactNode }) => children },
}));

const mockExtract = jest.fn();
const mockCreate = jest.fn();
jest.mock('../index', () => ({
  useExtractTips: () => ({ mutateAsync: mockExtract, isPending: false }),
  useCreateTripLog: () => ({ mutateAsync: mockCreate, isPending: false }),
}));

beforeEach(() => {
  mockReplace.mockReset();
  mockShow.mockReset();
  mockExtract.mockReset();
  mockCreate.mockReset();
});

describe('TripComposerScreen', () => {
  it('renders the four friend-framed prompts and the register-setting example', () => {
    renderWithProviders(<TripComposerScreen />);
    // Eyebrow uppercases its label text in JS.
    expect(screen.getByText('WHERE DID YOU GO?')).toBeTruthy();
    expect(screen.getByText('WORTH IT?')).toBeTruthy();
    expect(
      screen.getByText("IF A FRIEND WERE GOING, WHAT'S THE ONE THING YOU'D TELL THEM?"),
    ).toBeTruthy();
    expect(screen.getByText(/Stay at Banjara, book the tents/)).toBeTruthy();
  });

  it('keeps Find-the-tips disabled (no extraction) until destination and note are present', () => {
    renderWithProviders(<TripComposerScreen />);
    // The CTA is disabled while fields are empty, so pressing it is a no-op.
    fireEvent.press(screen.getByLabelText('Find the tips'));
    expect(mockExtract).not.toHaveBeenCalled();
  });

  it('extracts then shows the review phase with the extracted tips', async () => {
    mockExtract.mockResolvedValueOnce({
      destination_text: 'Spiti',
      original_note: 'Stay at Banjara, book the tents.',
      tips: [
        { text: 'Stay at Banjara', advice_type: 'stay', area_text: null, confidence: 0.82 },
        { text: 'Book the tents', advice_type: 'book', area_text: null, confidence: 0.68 },
      ],
    });
    renderWithProviders(<TripComposerScreen />);
    fireEvent.changeText(screen.getByLabelText('Destination'), 'Spiti');
    fireEvent.changeText(
      screen.getByLabelText("The one thing you'd tell a friend"),
      'Stay at Banjara, book the tents.',
    );
    fireEvent.press(screen.getByLabelText('Find the tips'));
    await waitFor(() => {
      expect(screen.getByText('Confirm your tips.')).toBeTruthy();
      expect(screen.getByDisplayValue('Stay at Banjara')).toBeTruthy();
      expect(screen.getByDisplayValue('Book the tents')).toBeTruthy();
    });
  });

  it('shows the zero-tip nudge when extraction finds nothing specific', async () => {
    mockExtract.mockResolvedValueOnce({
      destination_text: 'Goa',
      original_note: 'It was nice.',
      tips: [],
    });
    renderWithProviders(<TripComposerScreen />);
    fireEvent.changeText(screen.getByLabelText('Destination'), 'Goa');
    fireEvent.changeText(screen.getByLabelText("The one thing you'd tell a friend"), 'It was nice.');
    fireEvent.press(screen.getByLabelText('Find the tips'));
    await waitFor(() => {
      expect(screen.getByText('No specific tip in there yet.')).toBeTruthy();
    });
  });

  it('saves the log with confirmed tips and routes to the book', async () => {
    mockExtract.mockResolvedValueOnce({
      destination_text: 'Spiti',
      original_note: 'Stay at Banjara.',
      tips: [{ text: 'Stay at Banjara', advice_type: 'stay', area_text: null, confidence: 0.82 }],
    });
    mockCreate.mockResolvedValueOnce({ tripId: 't1', tipCount: 1 });
    renderWithProviders(<TripComposerScreen />);
    fireEvent.changeText(screen.getByLabelText('Destination'), 'Spiti');
    fireEvent.changeText(
      screen.getByLabelText("The one thing you'd tell a friend"),
      'Stay at Banjara.',
    );
    fireEvent.press(screen.getByLabelText('Find the tips'));
    await waitFor(() => screen.getByLabelText('Save and share'));
    fireEvent.press(screen.getByLabelText('Save and share'));
    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          form: expect.objectContaining({ destination_text: 'Spiti', verdict: 'love' }),
          tips: expect.arrayContaining([
            expect.objectContaining({ text: 'Stay at Banjara', advice_type: 'stay' }),
          ]),
        }),
      );
      expect(mockReplace).toHaveBeenCalledWith('/(tabs)/book');
    });
  });
});
