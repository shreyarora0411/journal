import { fireEvent, renderWithProviders, screen } from '@/test/render';
import { VerdictPicker } from './VerdictPicker';

describe('VerdictPicker', () => {
  it('defaults to love selected', () => {
    const onChange = jest.fn();
    renderWithProviders(<VerdictPicker onChange={onChange} />);
    const love = screen.getByTestId('verdict-love');
    expect(love.props.accessibilityState).toEqual(expect.objectContaining({ selected: true }));
    const mid = screen.getByTestId('verdict-mid');
    expect(mid.props.accessibilityState).toEqual(expect.objectContaining({ selected: false }));
  });

  it('renders three radios (love, mid, skip)', () => {
    renderWithProviders(<VerdictPicker onChange={() => undefined} />);
    expect(screen.getByLabelText('Love')).toBeTruthy();
    expect(screen.getByLabelText('Mid')).toBeTruthy();
    expect(screen.getByLabelText('Skip')).toBeTruthy();
  });

  it('calls onChange with the tapped verdict', () => {
    const onChange = jest.fn();
    renderWithProviders(<VerdictPicker value="love" onChange={onChange} />);
    fireEvent.press(screen.getByTestId('verdict-skip'));
    expect(onChange).toHaveBeenCalledWith('skip');
  });

  it('marks the controlled value as selected', () => {
    renderWithProviders(<VerdictPicker value="mid" onChange={() => undefined} />);
    expect(screen.getByTestId('verdict-mid').props.accessibilityState).toEqual(
      expect.objectContaining({ selected: true }),
    );
    expect(screen.getByTestId('verdict-love').props.accessibilityState).toEqual(
      expect.objectContaining({ selected: false }),
    );
  });
});
