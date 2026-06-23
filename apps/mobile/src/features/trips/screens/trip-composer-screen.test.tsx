import { fireEvent, renderWithProviders, screen, waitFor } from '@/test/render';
import { TripComposerScreen } from './trip-composer-screen';

const mockReplace = jest.fn();
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => mockParams,
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
  mockParams = {};
});

const fillVouch = (category: string, vouch: string, dest: string) => {
  fireEvent.press(screen.getByLabelText(category));
  fireEvent.changeText(screen.getByLabelText('The vouch'), vouch);
  fireEvent.changeText(screen.getByLabelText('Destination'), dest);
};

describe('TripComposerScreen (v3.1 batch composer)', () => {
  it('renders the list field and all six category chips incl Nightlife', () => {
    renderWithProviders(<TripComposerScreen />);
    expect(screen.getByText('TO WHICH LIST?')).toBeTruthy();
    expect(screen.getByLabelText('Where to stay?')).toBeTruthy();
    expect(screen.getByLabelText('Where to go out?')).toBeTruthy(); // nightlife
    expect(screen.getByLabelText('Anything to skip?')).toBeTruthy();
  });

  it('does not save until list, category, text, and destination are present', () => {
    renderWithProviders(<TripComposerScreen />);
    // list empty → even with a category+text it won't save
    fillVouch('Where to stay?', 'Banjara, book the tents', 'Spiti');
    fireEvent.press(screen.getByLabelText('Save and add another'));
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('banks a vouch without routing away, retains the list, increments the count', async () => {
    mockCreate.mockResolvedValue({ vouchId: 'v1', listId: 'l1' });
    renderWithProviders(<TripComposerScreen />);
    fireEvent.changeText(screen.getByLabelText('List name'), 'Koh Samui');
    fillVouch('Where to stay?', 'Lub’d Samui, beach-facing', 'Koh Samui');
    fireEvent.press(screen.getByLabelText('Save and add another'));
    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ vouch_type: 'stay', new_list_name: 'Koh Samui', list_id: null }),
      );
      // stayed on the composer (no route), banked count shows
      expect(mockReplace).not.toHaveBeenCalled();
      expect(screen.getByText('1 banked')).toBeTruthy();
    });
  });

  it('second vouch reuses the resolved list id (one list per session)', async () => {
    mockCreate.mockResolvedValueOnce({ vouchId: 'v1', listId: 'l1' });
    mockCreate.mockResolvedValueOnce({ vouchId: 'v2', listId: 'l1' });
    renderWithProviders(<TripComposerScreen />);
    fireEvent.changeText(screen.getByLabelText('List name'), 'Koh Samui');
    fillVouch('Where to stay?', 'Lub’d Samui', 'Koh Samui');
    fireEvent.press(screen.getByLabelText('Save and add another'));
    await waitFor(() => screen.getByText('1 banked'));
    fillVouch('Anything to skip?', 'Skip Evergreen, only the fish is good', 'Koh Samui');
    fireEvent.press(screen.getByLabelText('Save and add another'));
    await waitFor(() => {
      expect(mockCreate).toHaveBeenLastCalledWith(
        expect.objectContaining({ vouch_type: 'skip', list_id: 'l1' }),
      );
      expect(screen.getByText('2 banked')).toBeTruthy();
    });
  });

  it('Done routes to the resolved list', async () => {
    mockCreate.mockResolvedValue({ vouchId: 'v1', listId: 'l1' });
    renderWithProviders(<TripComposerScreen />);
    fireEvent.changeText(screen.getByLabelText('List name'), 'Koh Samui');
    fillVouch('Where to stay?', 'Lub’d Samui', 'Koh Samui');
    fireEvent.press(screen.getByLabelText('Save and add another'));
    await waitFor(() => screen.getByLabelText('Done'));
    fireEvent.press(screen.getByLabelText('Done'));
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)/list/l1');
  });

  it('locks the list when launched from a list (params prefill)', () => {
    mockParams = { listId: 'l9', listTitle: 'best mountain stays', destination: 'Spiti' };
    renderWithProviders(<TripComposerScreen />);
    // locked label, no editable list input
    expect(screen.getByText('best mountain stays')).toBeTruthy();
    expect(screen.queryByLabelText('List name')).toBeNull();
  });
});
