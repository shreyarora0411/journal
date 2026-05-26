import { fireEvent, renderWithProviders, screen } from '@/test/render';
import { LogScreen } from './log-screen';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn(), back: jest.fn() }),
  Link: ({ children }: { children: React.ReactNode }) => children,
}));

const mockShowToast = jest.fn();
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ show: mockShowToast }),
  ToastContext: { Provider: ({ children }: { children: React.ReactNode }) => children },
}));

const mockCreateTrip = jest.fn();
const mockResolvePlace = jest.fn();
const mockCreateAtomicLog = jest.fn();
jest.mock('@/features/trips', () => ({
  useCreateTripQuick: () => ({ mutateAsync: mockCreateTrip, isPending: false }),
  useResolvePlace: () => ({ mutateAsync: mockResolvePlace, isPending: false }),
  useCreateAtomicLog: () => ({ mutateAsync: mockCreateAtomicLog, isPending: false }),
  useMyTrips: () => ({ data: [], isLoading: false }),
}));

const mockSetVerdict = jest.fn();
jest.mock('@/features/verdicts', () => ({
  useSetVerdict: () => ({ mutateAsync: mockSetVerdict, isPending: false }),
}));

beforeEach(() => {
  mockReplace.mockReset();
  mockShowToast.mockReset();
  mockCreateTrip.mockReset();
  mockResolvePlace.mockReset();
  mockCreateAtomicLog.mockReset();
  mockSetVerdict.mockReset();
});

describe('LogScreen', () => {
  it('defaults to Tip mode and renders the atomic-log form surface', () => {
    renderWithProviders(<LogScreen />);
    expect(screen.getByText('Pop something in the book.')).toBeTruthy();
    // Toggle: both modes visible.
    expect(screen.getByLabelText('Switch to Tip mode')).toBeTruthy();
    expect(screen.getByLabelText('Switch to Trip mode')).toBeTruthy();
    // Tip form is the default child — picker open + verdict surface present.
    expect(screen.getByLabelText('Search place')).toBeTruthy();
    expect(screen.getByTestId('verdict-picker')).toBeTruthy();
  });

  it('submitting Tip without picking a place toasts an error', () => {
    renderWithProviders(<LogScreen />);
    fireEvent.press(screen.getByLabelText('Add to my book'));
    expect(mockShowToast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'error' }));
    expect(mockResolvePlace).not.toHaveBeenCalled();
    expect(mockCreateAtomicLog).not.toHaveBeenCalled();
  });

  it('switching to Trip mode shows the trip form headline and save CTA', () => {
    renderWithProviders(<LogScreen />);
    fireEvent.press(screen.getByLabelText('Switch to Trip mode'));
    expect(screen.getByText('Frame a trip.')).toBeTruthy();
    expect(screen.getByLabelText('Save trip')).toBeTruthy();
  });

  it('renders the emerald visibility reassurance line', () => {
    renderWithProviders(<LogScreen />);
    expect(screen.getByText(/Just my circle/)).toBeTruthy();
  });
});
