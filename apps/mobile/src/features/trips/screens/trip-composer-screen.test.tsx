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
  useCreateVouchedTrip: () => ({ mutateAsync: mockCreate, isPending: false }),
}));

beforeEach(() => {
  mockReplace.mockReset();
  mockShow.mockReset();
  mockCreate.mockReset();
});

describe('TripComposerScreen (v3 category-slotted, no extraction)', () => {
  it('renders the verdict frame and all five category asks', () => {
    renderWithProviders(<TripComposerScreen />);
    // Eyebrow uppercases its label text in JS.
    expect(screen.getByText('WHERE DID YOU GO?')).toBeTruthy();
    expect(screen.getByText('WORTH IT?')).toBeTruthy();
    expect(screen.getByText(/WHERE TO STAY\?/)).toBeTruthy();
    expect(screen.getByText(/WHERE TO EAT OR DRINK\?/)).toBeTruthy();
    expect(screen.getByText(/ONE THING TO DO\?/)).toBeTruthy();
    expect(screen.getByText(/ONE THING THAT'S GOOD TO KNOW\?/)).toBeTruthy();
    expect(screen.getByText(/ANYTHING TO SKIP\?/)).toBeTruthy();
  });

  it('does not save when no vouch has been entered', () => {
    renderWithProviders(<TripComposerScreen />);
    fireEvent.changeText(screen.getByLabelText('Destination'), 'Spiti');
    // Save is disabled with zero vouches → pressing is a no-op.
    fireEvent.press(screen.getByLabelText('Save and share'));
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('banks a vouch from a single category and saves it typed', async () => {
    mockCreate.mockResolvedValueOnce({ tripId: 't1', vouchCount: 1 });
    renderWithProviders(<TripComposerScreen />);
    fireEvent.changeText(screen.getByLabelText('Destination'), 'Spiti');
    fireEvent.changeText(screen.getByLabelText('Where to stay?'), 'Banjara, book the tents');
    fireEvent.press(screen.getByLabelText('Save and share'));
    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          destination_text: 'Spiti',
          verdict: 'love',
          vouches: [{ vouch_type: 'stay', text: 'Banjara, book the tents' }],
        }),
      );
      expect(mockReplace).toHaveBeenCalledWith('/(tabs)/book');
    });
  });

  it('banks multiple typed vouches from different slots', async () => {
    mockCreate.mockResolvedValueOnce({ tripId: 't1', vouchCount: 2 });
    renderWithProviders(<TripComposerScreen />);
    fireEvent.changeText(screen.getByLabelText('Destination'), 'Spiti');
    fireEvent.changeText(screen.getByLabelText('Where to stay?'), 'Banjara, book the tents');
    fireEvent.changeText(screen.getByLabelText('Anything to skip?'), 'Skip Kaza unless you need supplies');
    fireEvent.press(screen.getByLabelText('Save and share'));
    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          vouches: [
            { vouch_type: 'stay', text: 'Banjara, book the tents' },
            { vouch_type: 'skip', text: 'Skip Kaza unless you need supplies' },
          ],
        }),
      );
    });
  });

  it('shows a soft specificity nudge on a one-word vouch (never blocks)', () => {
    renderWithProviders(<TripComposerScreen />);
    fireEvent.changeText(screen.getByLabelText('Where to eat or drink?'), 'nice');
    expect(screen.getByText('One place, dish, or specific thing?')).toBeTruthy();
  });
});
