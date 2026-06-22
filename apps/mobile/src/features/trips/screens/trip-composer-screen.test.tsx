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

const mockCreate = jest.fn();
jest.mock('../index', () => ({
  useCreateVouch: () => ({ mutateAsync: mockCreate, isPending: false }),
}));

beforeEach(() => {
  mockReplace.mockReset();
  mockShow.mockReset();
  mockCreate.mockReset();
});

describe('TripComposerScreen (v3.1 single vouch → list)', () => {
  it('renders the category chips', () => {
    renderWithProviders(<TripComposerScreen />);
    expect(screen.getByText('WHAT KIND?')).toBeTruthy();
    expect(screen.getByLabelText('Where to stay?')).toBeTruthy();
    expect(screen.getByLabelText('Anything to skip?')).toBeTruthy();
  });

  it('reveals the vouch field + destination only after a category is picked', () => {
    renderWithProviders(<TripComposerScreen />);
    expect(screen.queryByLabelText('The vouch')).toBeNull();
    fireEvent.press(screen.getByLabelText('Where to stay?'));
    expect(screen.getByLabelText('The vouch')).toBeTruthy();
    expect(screen.getByLabelText('Destination')).toBeTruthy();
  });

  it('does not save until category, text, and destination are present', () => {
    renderWithProviders(<TripComposerScreen />);
    fireEvent.press(screen.getByLabelText('Where to stay?'));
    fireEvent.changeText(screen.getByLabelText('The vouch'), 'Banjara, book the tents');
    // No destination yet → save is a no-op.
    fireEvent.press(screen.getByLabelText('Save vouch'));
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('saves a single typed vouch and routes to its list', async () => {
    mockCreate.mockResolvedValueOnce({ vouchId: 'v1', listId: 'l1' });
    renderWithProviders(<TripComposerScreen />);
    fireEvent.press(screen.getByLabelText('Where to stay?'));
    fireEvent.changeText(screen.getByLabelText('The vouch'), 'Banjara, book the tents');
    fireEvent.changeText(screen.getByLabelText('Destination'), 'Spiti');
    fireEvent.press(screen.getByLabelText('Save vouch'));
    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          vouch_type: 'stay',
          text: 'Banjara, book the tents',
          destination_text: 'Spiti',
        }),
      );
      expect(mockReplace).toHaveBeenCalledWith('/(tabs)/list/l1');
    });
  });

  it('passes a custom list name when the user creates a new list', async () => {
    mockCreate.mockResolvedValueOnce({ vouchId: 'v1', listId: 'l9' });
    renderWithProviders(<TripComposerScreen />);
    fireEvent.press(screen.getByLabelText('Where to stay?'));
    fireEvent.changeText(screen.getByLabelText('The vouch'), '28 Kothi, small and lovely');
    fireEvent.changeText(screen.getByLabelText('Destination'), 'Jaipur');
    fireEvent.press(screen.getByLabelText('Use a different list'));
    fireEvent.changeText(screen.getByLabelText('New list name'), 'Best heritage stays');
    fireEvent.press(screen.getByLabelText('Save vouch'));
    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ new_list_name: 'Best heritage stays' }),
      );
    });
  });

  it('shows the soft specificity nudge on a one-word vouch (never blocks)', () => {
    renderWithProviders(<TripComposerScreen />);
    fireEvent.press(screen.getByLabelText('Where to eat or drink?'));
    fireEvent.changeText(screen.getByLabelText('The vouch'), 'nice');
    expect(screen.getByText('One place, dish, or specific thing?')).toBeTruthy();
  });
});
