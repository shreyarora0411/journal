import { fireEvent, renderWithProviders, screen } from '@/test/render';
import { AltImportCard } from './AltImportCard';

describe('AltImportCard', () => {
  it('renders the label and sub copy', () => {
    renderWithProviders(<AltImportCard onPress={() => undefined} />);
    expect(screen.getByText('Continue with your camera roll')).toBeTruthy();
    expect(
      screen.getByText("We'll group your last 6 months of photos into trip drafts."),
    ).toBeTruthy();
  });

  it('renders a trailing chevron', () => {
    renderWithProviders(<AltImportCard onPress={() => undefined} />);
    expect(screen.getByText('→')).toBeTruthy();
  });

  it('calls onPress when tapped', () => {
    const onPress = jest.fn();
    renderWithProviders(<AltImportCard onPress={onPress} />);
    fireEvent.press(screen.getByLabelText('Continue with your camera roll'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
