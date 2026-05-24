import { fireEvent, renderWithProviders, screen } from '@/test/render';
import { TripNotebookScreen } from './trip-notebook-screen';

const mockBack = jest.fn();
const mockId = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => ({ id: mockId() }),
}));

beforeEach(() => {
  mockBack.mockReset();
  mockId.mockReset();
});

describe('TripNotebookScreen', () => {
  it('renders the eyebrow, owner-named title, meta line, and all 4 entries', () => {
    mockId.mockReturnValue('kabir-tokyo');
    renderWithProviders(<TripNotebookScreen />);
    expect(screen.getByText('MAR 2026 · 4 DAYS')).toBeTruthy();
    // Owner name in italic-serif title
    expect(screen.getByText('Kabir', { exact: false })).toBeTruthy();
    // Meta line
    expect(screen.getByText('4 entries · 12 photos · 6 friends stole tips')).toBeTruthy();
    // All four timeline entries
    expect(screen.getByLabelText('Hotel K5')).toBeTruthy();
    expect(screen.getByLabelText('Bricolage Bread & Co.')).toBeTruthy();
    expect(screen.getByLabelText('Toraya')).toBeTruthy();
    expect(screen.getByLabelText('Yanaka')).toBeTruthy();
  });

  it('shows "Trip not found" when the id does not resolve', () => {
    mockId.mockReturnValue('made-up');
    renderWithProviders(<TripNotebookScreen />);
    expect(screen.getByText('Trip not found.')).toBeTruthy();
  });

  it('tapping Back calls router.back', () => {
    mockId.mockReturnValue('kabir-tokyo');
    renderWithProviders(<TripNotebookScreen />);
    fireEvent.press(screen.getByLabelText('Back'));
    expect(mockBack).toHaveBeenCalled();
  });
});
