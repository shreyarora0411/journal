import { fireEvent, renderWithProviders, screen, waitFor } from '@/test/render';
import { Share } from 'react-native';
import { TasteShareCard } from './taste-share-card';

const mockCapture = jest.fn();
// Declared inside the factory (no external reference) so Jest's mock-hoisting
// never sees an uninitialized binding — mirrors the pattern used throughout
// this codebase's tests (see login-screen.test.tsx).
jest.mock('react-native-view-shot', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: React.forwardRef(function MockViewShot(
      props: { children?: React.ReactNode },
      ref: React.Ref<{ capture: () => Promise<string> }>,
    ) {
      React.useImperativeHandle(ref, () => ({ capture: mockCapture }));
      return props.children ?? null;
    }),
  };
});

const baseProps = {
  onClose: jest.fn(),
  axes: {
    substance_scene: -0.4,
    mellow_lively: 0.5,
    adventurous_trusty: 0,
    refined_unfussy: 0,
    value_splurge: 0.3,
  },
  readout: ['substance-first', 'high-energy'],
  lovedCount: 19,
  hubCount: 5,
  places: [
    { name: 'Anardana', note: 'the butter chicken is not optional' },
    { name: 'Gulati', note: null },
    { name: 'Diggin', note: 'best cold brew in Gurgaon' },
  ],
  inviteText: "i'm on Vouch — my map of places i actually love.",
};

beforeEach(() => {
  mockCapture.mockReset();
  mockCapture.mockResolvedValue('file:///tmp/taste-card.png');
  baseProps.onClose.mockReset();
  jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('TasteShareCard', () => {
  it('renders nothing when not visible', () => {
    renderWithProviders(<TasteShareCard visible={false} {...baseProps} />);
    expect(screen.queryByText('substance-first · high-energy.')).toBeNull();
  });

  it('renders the readout, stats, and noted loved places when visible', () => {
    renderWithProviders(<TasteShareCard visible {...baseProps} />);
    expect(screen.getByLabelText('Vouch.')).toBeTruthy();
    expect(screen.getByText('substance-first · high-energy.')).toBeTruthy();
    expect(screen.getByText('19 loves · 5 hubs')).toBeTruthy();
    expect(screen.getByText('Anardana')).toBeTruthy();
    expect(screen.getByText('"the butter chicken is not optional"')).toBeTruthy();
    expect(screen.getByText('"best cold brew in Gurgaon"')).toBeTruthy();
    // Noted places are preferred over noteless ones — Gulati (no note)
    // shouldn't need to appear while 2 noted places already exist.
    expect(screen.queryByText('Gulati')).toBeNull();
    expect(screen.getByText(baseProps.inviteText)).toBeTruthy();
  });

  it('shows the singular love/hub count correctly', () => {
    renderWithProviders(
      <TasteShareCard visible {...baseProps} lovedCount={1} hubCount={1} places={[]} />,
    );
    expect(screen.getByText('1 love · 1 hub')).toBeTruthy();
  });

  it('falls back to a neutral prompt when the readout is empty', () => {
    renderWithProviders(<TasteShareCard visible {...baseProps} readout={[]} />);
    expect(screen.getByText('Still finding its shape.')).toBeTruthy();
  });

  it('tapping Share captures the card and hands the file URI to Share.share', async () => {
    renderWithProviders(<TasteShareCard visible {...baseProps} />);
    fireEvent.press(screen.getByLabelText('Share to...'));
    await waitFor(() => {
      expect(mockCapture).toHaveBeenCalled();
      expect(Share.share).toHaveBeenCalledWith({
        url: 'file:///tmp/taste-card.png',
        message: baseProps.inviteText,
      });
    });
  });

  it('tapping Close calls onClose', () => {
    renderWithProviders(<TasteShareCard visible {...baseProps} />);
    fireEvent.press(screen.getByLabelText('Close'));
    expect(baseProps.onClose).toHaveBeenCalled();
  });
});
