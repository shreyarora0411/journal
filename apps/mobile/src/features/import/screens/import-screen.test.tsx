import { fireEvent, renderWithProviders, screen, waitFor } from '@/test/render';
import type { ClassifiedTrip } from '../api/use-load-photos';
import ImportScreen from './import-screen';

const mockMutateAsync = jest.fn();
jest.mock('../api/use-load-photos', () => ({
  useLoadCameraRoll: () => ({ mutateAsync: mockMutateAsync, isPending: false }),
}));

const mockCreateTrip = jest.fn();
jest.mock('@/features/trips', () => ({
  useCreateTripQuick: () => ({ mutateAsync: mockCreateTrip, isPending: false }),
}));

const mockProfile = jest.fn();
jest.mock('@/features/auth', () => ({
  useProfile: () => mockProfile(),
}));

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: mockReplace, back: jest.fn() }),
}));

const tripCluster: ClassifiedTrip = {
  id: 'trip-1',
  startMs: new Date('2025-11-15').getTime(),
  endMs: new Date('2025-11-17').getTime(),
  durationDays: 3,
  suggestedTitle: '15 Nov – 17 Nov 2025',
  suggestedPlace: 'Goa',
  kind: 'trip',
  photos: [
    { id: 'p1', uri: 'https://example.com/1.jpg', creationTime: 1 },
    { id: 'p2', uri: 'https://example.com/2.jpg', creationTime: 2 },
    { id: 'p3', uri: 'https://example.com/3.jpg', creationTime: 3 },
  ],
};

const profileWithHome = {
  data: {
    home_city: 'Mumbai',
    home_lat: 19.076,
    home_lng: 72.877,
    home_country_code: 'IN',
  },
};

beforeEach(() => {
  mockMutateAsync.mockReset();
  mockCreateTrip.mockReset();
  mockReplace.mockReset();
  mockProfile.mockReset();
  mockProfile.mockReturnValue(profileWithHome);
});

describe('ImportScreen (Batch A #5 — dual source)', () => {
  it('renders the step 3 eyebrow, headline, and both source sections', () => {
    renderWithProviders(<ImportScreen />);
    expect(screen.getByText('STEP 3 OF 4')).toBeTruthy();
    expect(screen.getByText(/trips, hiding/)).toBeTruthy();
    expect(screen.getByText('FROM INSTAGRAM')).toBeTruthy();
    expect(screen.getByText('FROM YOUR CAMERA ROLL')).toBeTruthy();
  });

  it('renders the 4 Instagram fixture cards and they default selected', () => {
    renderWithProviders(<ImportScreen />);
    expect(screen.getByLabelText('Lisbon, Mar 2026')).toBeTruthy();
    expect(screen.getByLabelText('Tokyo, Feb 2026')).toBeTruthy();
    expect(screen.getByLabelText('Pondicherry, Jan 2026')).toBeTruthy();
    expect(screen.getByLabelText('Sri Lanka, Dec 2025')).toBeTruthy();
    // 4 IG + 0 camera-roll = "Pop 4 trips into my book →"
    expect(screen.getByText(/Pop 4 trips into my book/)).toBeTruthy();
  });

  it('CTA count drops when an Instagram trip is deselected', () => {
    renderWithProviders(<ImportScreen />);
    fireEvent.press(screen.getByLabelText('Lisbon, Mar 2026'));
    expect(screen.getByText(/Pop 3 trips into my book/)).toBeTruthy();
  });

  it('camera-roll scan appends trips to the same selection model', async () => {
    mockMutateAsync.mockResolvedValueOnce({ proposed: [tripCluster], supported: true });
    renderWithProviders(<ImportScreen />);
    fireEvent.press(screen.getByText('Read my photos'));
    await waitFor(() => {
      // 4 IG (default selected) + 1 camera-roll trip (default selected) = 5
      expect(screen.getByText(/Pop 5 trips into my book/)).toBeTruthy();
    });
    expect(screen.getByDisplayValue('Goa')).toBeTruthy();
  });

  it('Save with no selections toasts an error and does not draft anything', async () => {
    renderWithProviders(<ImportScreen />);
    // Untoggle all 4 IG fixtures.
    fireEvent.press(screen.getByLabelText('Lisbon, Mar 2026'));
    fireEvent.press(screen.getByLabelText('Tokyo, Feb 2026'));
    fireEvent.press(screen.getByLabelText('Pondicherry, Jan 2026'));
    fireEvent.press(screen.getByLabelText('Sri Lanka, Dec 2025'));
    fireEvent.press(screen.getByText('Pop 0 trips into my book →'));
    await waitFor(() => {
      expect(mockCreateTrip).not.toHaveBeenCalled();
    });
  });
});
