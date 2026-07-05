import { fireEvent, renderWithProviders, screen, waitFor } from '@/test/render';
import * as Haptics from 'expo-haptics';
import { TasteSetupScreen } from './taste-setup-screen';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn(), back: jest.fn() }),
}));

const mockToastShow = jest.fn();
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ show: mockToastShow }),
  ToastContext: { Provider: ({ children }: { children: React.ReactNode }) => children },
}));

const mockUpdateProfileMutateAsync = jest.fn();
jest.mock('@/features/auth', () => ({
  useAuthStore: <T,>(selector: (s: { session: { user: { id: string } } | null }) => T) =>
    selector({ session: { user: { id: 'user-1' } } }),
  useUpdateProfile: () => ({ mutateAsync: mockUpdateProfileMutateAsync, isPending: false }),
}));

const mockFollowMutate = jest.fn();
const mockUnfollowMutate = jest.fn();
jest.mock('@/features/follows', () => ({
  useFollow: () => ({ mutate: mockFollowMutate, mutateAsync: jest.fn(), isPending: false }),
  useUnfollow: () => ({ mutate: mockUnfollowMutate, mutateAsync: jest.fn(), isPending: false }),
}));

const mockLogPlaceMutateAsync = jest.fn();
jest.mock('../api/use-log-place', () => ({
  useLogPlace: () => ({ mutateAsync: mockLogPlaceMutateAsync, isPending: false }),
}));

const mockSavePriorsMutateAsync = jest.fn();
jest.mock('../api/use-save-priors', () => ({
  useSavePriors: () => ({ mutateAsync: mockSavePriorsMutateAsync, isPending: false }),
}));

const mockMyPriors = jest.fn();
const mockMyPlaces = jest.fn();
const mockTasteTwins = jest.fn();
jest.mock('../api/use-taste-data', () => ({
  useMyPriors: () => mockMyPriors(),
  useMyPlaces: () => mockMyPlaces(),
  useTasteTwins: () => mockTasteTwins(),
}));

type CorpusRow = {
  google_place_id: string;
  name: string;
  hub: string | null;
  zone: string | null;
  destination_text: string | null;
  lat: number | null;
  lng: number | null;
};

// Two hubs, three venues — enough to prove grouping + ordering without
// dragging in the real 71-venue seed corpus.
let mockCorpusRows: CorpusRow[] = [];

const mockDeleteEq2 = jest.fn(() => Promise.resolve({ error: null as { message: string } | null }));
const mockDeleteEq1 = jest.fn(() => ({ eq: mockDeleteEq2 }));
const mockDelete = jest.fn(() => ({ eq: mockDeleteEq1 }));

jest.mock('@/lib/supabase', () => ({
  getSupabase: () => ({
    from: (table: string) => {
      if (table === 'canonical_places') {
        return {
          select: () => ({
            not: () => ({
              order: () => ({
                limit: () => Promise.resolve({ data: mockCorpusRows, error: null }),
              }),
            }),
          }),
        };
      }
      if (table === 'place_reactions') {
        return { delete: mockDelete };
      }
      throw new Error(`taste-setup-screen.test: unexpected table "${table}"`);
    },
  }),
}));

beforeEach(() => {
  mockReplace.mockReset();
  mockToastShow.mockReset();
  mockUpdateProfileMutateAsync.mockReset();
  mockUpdateProfileMutateAsync.mockResolvedValue({});
  mockFollowMutate.mockReset();
  mockUnfollowMutate.mockReset();
  mockLogPlaceMutateAsync.mockReset();
  mockLogPlaceMutateAsync.mockImplementation(async ({ place }) => ({
    placeId: `place-for-${place.google_place_id}`,
    noteSaved: true,
    addedToList: false,
  }));
  mockSavePriorsMutateAsync.mockReset();
  mockSavePriorsMutateAsync.mockResolvedValue(undefined);
  mockMyPriors.mockReset();
  mockMyPriors.mockReturnValue({ data: null });
  mockMyPlaces.mockReset();
  mockMyPlaces.mockReturnValue({ data: [] });
  mockTasteTwins.mockReset();
  mockTasteTwins.mockReturnValue({ data: [], isLoading: false });
  mockDeleteEq2.mockClear();
  mockDeleteEq1.mockClear();
  mockDelete.mockClear();

  mockCorpusRows = [
    {
      google_place_id: 'g-sequel',
      name: 'Sequel',
      hub: 'gcr',
      zone: 'gurgaon',
      destination_text: 'Gurgaon',
      lat: 28.45,
      lng: 77.09,
    },
    {
      google_place_id: 'g-warehouse',
      name: 'Warehouse Cafe',
      hub: 'gcr',
      zone: 'gurgaon',
      destination_text: 'Gurgaon',
      lat: 28.451,
      lng: 77.091,
    },
    {
      google_place_id: 'g-botai',
      name: 'Bo Tai',
      hub: 'kitchens',
      zone: 'gurgaon',
      destination_text: 'Gurgaon',
      lat: 28.46,
      lng: 77.08,
    },
  ];
});

const answerQuizAndContinue = async () => {
  fireEvent.press(screen.getByLabelText('The food/drink itself'));
  fireEvent.press(screen.getByLabelText('Quiet drinks, real talk'));
  fireEvent.press(screen.getByLabelText('Always the new place'));
  fireEvent.press(screen.getByLabelText('Find the value gem'));
  fireEvent.press(screen.getByLabelText('Continue to picking places'));
  await screen.findByText('Eight places that are so you.');
};

describe('TasteSetupScreen — places phase (curated grid)', () => {
  it('renders the curated grid grouped by hub, and the goal is 8', async () => {
    renderWithProviders(<TasteSetupScreen />);
    await answerQuizAndContinue();

    await screen.findByText('Sequel');
    expect(screen.getByText('Golf Course Rd')).toBeTruthy();
    expect(screen.getByText('The Kitchens')).toBeTruthy();
    expect(screen.getByText('Warehouse Cafe')).toBeTruthy();
    expect(screen.getByText('Bo Tai')).toBeTruthy();
    expect(screen.getByText('0/8 — keep going.')).toBeTruthy();
  });

  it('tapping a tile logs an immediate loved reaction and flips to a picked/checkmark state', async () => {
    renderWithProviders(<TasteSetupScreen />);
    await answerQuizAndContinue();
    await screen.findByText('Sequel');

    fireEvent.press(screen.getByLabelText('Add Sequel'));

    await waitFor(() => {
      expect(mockLogPlaceMutateAsync).toHaveBeenCalledWith({
        place: expect.objectContaining({ google_place_id: 'g-sequel', name: 'Sequel' }),
        sentiment: 'loved',
      });
    });
    expect(await screen.findByLabelText('Remove Sequel')).toBeTruthy();
    expect(screen.getByText('1/8 — keep going.')).toBeTruthy();
  });

  it('tapping a picked tile again removes it (unlog) and clears the checkmark', async () => {
    renderWithProviders(<TasteSetupScreen />);
    await answerQuizAndContinue();
    await screen.findByText('Sequel');

    fireEvent.press(screen.getByLabelText('Add Sequel'));
    await screen.findByLabelText('Remove Sequel');

    fireEvent.press(screen.getByLabelText('Remove Sequel'));

    await waitFor(() => {
      expect(mockDelete).toHaveBeenCalled();
      expect(mockDeleteEq1).toHaveBeenCalledWith('user_id', 'user-1');
      expect(mockDeleteEq2).toHaveBeenCalledWith('place_id', 'place-for-g-sequel');
    });
    expect(await screen.findByLabelText('Add Sequel')).toBeTruthy();
    expect(screen.getByText('0/8 — keep going.')).toBeTruthy();
  });

  it('the picked-places list offers its own remove affordance too', async () => {
    renderWithProviders(<TasteSetupScreen />);
    await answerQuizAndContinue();
    await screen.findByText('Sequel');

    fireEvent.press(screen.getByLabelText('Add Sequel'));
    const removeFromList = await screen.findByLabelText('Remove Sequel from your picks');
    fireEvent.press(removeFromList);

    await waitFor(() => expect(mockDelete).toHaveBeenCalled());
    expect(screen.queryByLabelText('Remove Sequel')).toBeNull();
  });

  it('keeps the typeahead PlacePicker available as a fallback behind a toggle', async () => {
    renderWithProviders(<TasteSetupScreen />);
    await answerQuizAndContinue();
    await screen.findByText('Sequel');

    expect(screen.queryByLabelText('Search place')).toBeNull();
    fireEvent.press(screen.getByLabelText("Can't find it? Search instead"));
    expect(screen.getByLabelText('Search place')).toBeTruthy();
  });
});

describe('TasteSetupScreen — follow-seed-maps step', () => {
  const twin = (over: Partial<Record<string, unknown>> = {}) => ({
    user_id: 'twin-1',
    display_name: 'Riya',
    handle: '@riya',
    avatar_url: null,
    match: 0.82,
    followed: false,
    love_count: 12,
    ...over,
  });

  it('after finishing the places phase, offers seed maps to follow — and Follow calls useFollow', async () => {
    mockTasteTwins.mockReturnValue({ data: [twin()], isLoading: false });
    renderWithProviders(<TasteSetupScreen />);
    await answerQuizAndContinue();
    await screen.findByText('Sequel');

    fireEvent.press(screen.getByLabelText('Add Sequel'));
    await screen.findByLabelText('Remove Sequel');
    fireEvent.press(screen.getByLabelText('Finish taste setup'));

    await screen.findByText('Follow a few seed maps.');
    expect(screen.getByText('Riya')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Follow Riya'));
    expect(mockFollowMutate).toHaveBeenCalledWith('twin-1');
  });

  it('the follow step is skippable and never blocks finishing onboarding, even with no seed suggestions', async () => {
    mockTasteTwins.mockReturnValue({ data: [], isLoading: false });
    renderWithProviders(<TasteSetupScreen />);
    await answerQuizAndContinue();
    await screen.findByText('Sequel');

    fireEvent.press(screen.getByLabelText('Add Sequel'));
    await screen.findByLabelText('Remove Sequel');
    fireEvent.press(screen.getByLabelText('Finish taste setup'));

    await screen.findByText('No seed maps yet.');
    fireEvent.press(screen.getByLabelText('Finish taste setup'));

    await waitFor(() => {
      expect(mockUpdateProfileMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ onboarding_completed: true }),
      );
      expect(mockReplace).toHaveBeenCalledWith('/(tabs)/book');
    });
  });
});

describe('TasteSetupScreen — goal-crossing haptic', () => {
  it('fires the success haptic on the exact tap that reaches the goal, not before', async () => {
    mockCorpusRows = Array.from({ length: 8 }, (_, i) => ({
      google_place_id: `g-spot-${i}`,
      name: `Spot ${i}`,
      hub: 'gcr',
      zone: 'gurgaon',
      destination_text: 'Gurgaon',
      lat: 28.45,
      lng: 77.09,
    }));

    renderWithProviders(<TasteSetupScreen />);
    await answerQuizAndContinue();
    await screen.findByText('Spot 0');

    const notificationAsync = Haptics.notificationAsync as jest.Mock;
    notificationAsync.mockClear();

    for (let i = 0; i < 7; i++) {
      fireEvent.press(screen.getByLabelText(`Add Spot ${i}`));
      await screen.findByLabelText(`Remove Spot ${i}`);
    }
    expect(notificationAsync).not.toHaveBeenCalled();

    fireEvent.press(screen.getByLabelText('Add Spot 7'));
    await screen.findByText('8/8 — that’s a taste.');

    expect(notificationAsync).toHaveBeenCalledTimes(1);
    expect(notificationAsync).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Success);
  });
});
