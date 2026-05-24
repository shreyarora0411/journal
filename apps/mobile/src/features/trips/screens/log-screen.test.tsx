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
jest.mock('@/features/trips', () => ({
  useCreateTripQuick: () => ({ mutateAsync: mockCreateTrip, isPending: false }),
}));

beforeEach(() => {
  mockReplace.mockReset();
  mockShowToast.mockReset();
  mockCreateTrip.mockReset();
});

describe('LogScreen', () => {
  it('renders both mode toggles, headline, place card, category chips, and verdict', () => {
    renderWithProviders(<LogScreen />);
    expect(screen.getByLabelText('Quick tip')).toBeTruthy();
    expect(screen.getByLabelText('Journal entry')).toBeTruthy();
    expect(screen.getByText('Pop something in the book.')).toBeTruthy();
    expect(screen.getByText('Café Des Arts')).toBeTruthy();
    expect(screen.getByText("WHAT I'D TELL A FRIEND")).toBeTruthy();
    expect(screen.getByTestId('verdict-picker')).toBeTruthy();
  });

  it('submitting with an empty body toasts an error and does not save', () => {
    renderWithProviders(<LogScreen />);
    fireEvent.press(screen.getByLabelText('Add to my book'));
    expect(mockShowToast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'error' }));
    expect(mockCreateTrip).not.toHaveBeenCalled();
  });

  it('renders the emerald visibility reassurance line', () => {
    renderWithProviders(<LogScreen />);
    expect(screen.getByText(/Just my circle/)).toBeTruthy();
  });
});
