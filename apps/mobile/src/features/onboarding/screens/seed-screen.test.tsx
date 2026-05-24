import { fireEvent, renderWithProviders, screen, waitFor } from '@/test/render';
import { SeedScreen } from './seed-screen';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn(), back: jest.fn() }),
}));

const mockProfileMutate = jest.fn();
jest.mock('@/features/auth', () => ({
  useUpdateProfile: () => ({ mutateAsync: mockProfileMutate, isPending: false }),
}));

const mockTrips = jest.fn();
const mockUpdateTrip = jest.fn();
jest.mock('@/features/trips', () => ({
  useMyTrips: () => mockTrips(),
  useUpdateTrip: () => ({ mutateAsync: mockUpdateTrip, isPending: false }),
}));

const sampleTrips = [
  { id: 't1', title: 'Lisbon', start_date: '2026-03-15', end_date: '2026-03-19' },
  { id: 't2', title: 'Tokyo', start_date: '2026-02-04', end_date: '2026-02-10' },
];

beforeEach(() => {
  mockReplace.mockReset();
  mockProfileMutate.mockReset();
  mockUpdateTrip.mockReset();
  mockTrips.mockReset();
  mockTrips.mockReturnValue({ data: sampleTrips, isLoading: false });
});

describe('SeedScreen', () => {
  it('renders step 4 eyebrow, current trip headline, and the input', () => {
    renderWithProviders(<SeedScreen />);
    expect(screen.getByText('STEP 4 OF 4')).toBeTruthy();
    expect(screen.getByText('1 OF 2 TRIPS')).toBeTruthy();
    // The destination name is rendered inside the headline; match a fragment.
    expect(screen.getByText(/One thing I'd tell/)).toBeTruthy();
    expect(screen.getByLabelText('Your sentence')).toBeTruthy();
  });

  it('Save & next advances to the next trip and clears the input', async () => {
    mockUpdateTrip.mockResolvedValue({});
    renderWithProviders(<SeedScreen />);
    fireEvent.changeText(screen.getByLabelText('Your sentence'), 'Stay in Alfama.');
    fireEvent.press(screen.getByLabelText('Save and next'));
    await waitFor(() => {
      expect(mockUpdateTrip).toHaveBeenCalledWith({
        id: 't1',
        patch: { note: 'Stay in Alfama.' },
      });
      expect(screen.getByText('2 OF 2 TRIPS')).toBeTruthy();
    });
  });

  it('on the last trip, Save & next marks onboarding completed and routes to /tabs/book', async () => {
    mockUpdateTrip.mockResolvedValue({});
    mockProfileMutate.mockResolvedValue({});
    // Single-trip case so the first save is the last save.
    mockTrips.mockReturnValue({ data: [sampleTrips[0]], isLoading: false });
    renderWithProviders(<SeedScreen />);
    fireEvent.changeText(screen.getByLabelText('Your sentence'), 'Stay in Alfama.');
    fireEvent.press(screen.getByLabelText('Save and next'));
    await waitFor(() => {
      expect(mockProfileMutate).toHaveBeenCalledWith({ onboarding_completed: true });
      expect(mockReplace).toHaveBeenCalledWith('/(tabs)/book');
    });
  });

  it('Skip advances without persisting a note', () => {
    renderWithProviders(<SeedScreen />);
    fireEvent.press(screen.getByLabelText('Skip this trip'));
    expect(mockUpdateTrip).not.toHaveBeenCalled();
    expect(screen.getByText('2 OF 2 TRIPS')).toBeTruthy();
  });
});
