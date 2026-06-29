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

describe('TripComposerScreen (fast door + curate)', () => {
  describe('FAST mode (fresh Add tab, no listId)', () => {
    it('renders the category chips and NO "which list?" field', () => {
      renderWithProviders(<TripComposerScreen />);
      // The list wall is gone in fast mode — no list name input, no eyebrow.
      expect(screen.queryByLabelText('List name')).toBeNull();
      expect(screen.queryByText('TO WHICH LIST?')).toBeNull();
      // Category chips still render.
      expect(screen.getByLabelText('Where to stay?')).toBeTruthy();
      expect(screen.getByLabelText('Where to go out?')).toBeTruthy(); // nightlife
      expect(screen.getByLabelText('Anything to skip?')).toBeTruthy();
    });

    it('does not save until category, text, and destination are present', () => {
      renderWithProviders(<TripComposerScreen />);
      fireEvent.press(screen.getByLabelText('Where to stay?'));
      // No text / destination yet → save is a no-op.
      fireEvent.press(screen.getByLabelText('Save and add another'));
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('banks a STANDALONE vouch — no list_id, no new_list_name', async () => {
      mockCreate.mockResolvedValue({ vouchId: 'v1', listId: null });
      renderWithProviders(<TripComposerScreen />);
      fillVouch('Where to stay?', 'Lub’d Samui, beach-facing', 'Koh Samui');
      fireEvent.press(screen.getByLabelText('Save and add another'));
      await waitFor(() => {
        expect(mockCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            vouch_type: 'stay',
            list_id: null,
            new_list_name: null,
          }),
        );
        // Stayed on the composer (no route), banked count shows.
        expect(mockReplace).not.toHaveBeenCalled();
        expect(screen.getByText('1 banked')).toBeTruthy();
      });
    });

    it('Done routes to the profile (your vouches)', async () => {
      mockCreate.mockResolvedValue({ vouchId: 'v1', listId: null });
      renderWithProviders(<TripComposerScreen />);
      fillVouch('Where to stay?', 'Lub’d Samui', 'Koh Samui');
      fireEvent.press(screen.getByLabelText('Save and add another'));
      await waitFor(() => screen.getByLabelText('Done'));
      fireEvent.press(screen.getByLabelText('Done'));
      expect(mockReplace).toHaveBeenCalledWith('/(tabs)/you');
    });
  });

  describe('CURATE mode (launched from a list)', () => {
    it('locks the list and shows it — no editable list input', () => {
      mockParams = { listId: 'l9', listTitle: 'best mountain stays', destination: 'Spiti' };
      renderWithProviders(<TripComposerScreen />);
      expect(screen.getByText('best mountain stays')).toBeTruthy();
      expect(screen.queryByLabelText('List name')).toBeNull();
    });

    it('batches every vouch into the locked list', async () => {
      mockParams = { listId: 'l9', listTitle: 'best mountain stays', destination: 'Spiti' };
      mockCreate.mockResolvedValue({ vouchId: 'v1', listId: 'l9' });
      renderWithProviders(<TripComposerScreen />);
      fillVouch('Where to stay?', 'Banjara, book the tents', 'Spiti');
      fireEvent.press(screen.getByLabelText('Save and add another'));
      await waitFor(() => {
        expect(mockCreate).toHaveBeenCalledWith(
          expect.objectContaining({ vouch_type: 'stay', list_id: 'l9', new_list_name: null }),
        );
        expect(screen.getByText('1 banked')).toBeTruthy();
      });
    });

    it('Done routes to the locked list', async () => {
      mockParams = { listId: 'l9', listTitle: 'best mountain stays', destination: 'Spiti' };
      mockCreate.mockResolvedValue({ vouchId: 'v1', listId: 'l9' });
      renderWithProviders(<TripComposerScreen />);
      fillVouch('Where to stay?', 'Banjara', 'Spiti');
      fireEvent.press(screen.getByLabelText('Save and add another'));
      await waitFor(() => screen.getByLabelText('Done'));
      fireEvent.press(screen.getByLabelText('Done'));
      expect(mockReplace).toHaveBeenCalledWith('/(tabs)/list/l9');
    });
  });
});
