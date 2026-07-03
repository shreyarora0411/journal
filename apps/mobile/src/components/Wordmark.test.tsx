import { renderWithProviders, screen } from '@/test/render';
import { Wordmark } from './Wordmark';

describe('Wordmark', () => {
  it('renders the Vouch. wordmark text', () => {
    renderWithProviders(<Wordmark />);
    expect(screen.getByLabelText('Vouch.')).toBeTruthy();
  });

  it('renders the trailing dot in coral (#FF4D2E)', () => {
    renderWithProviders(<Wordmark />);
    const dot = screen.getByTestId('wordmark-dot');
    expect(dot.props.style).toEqual(expect.objectContaining({ color: '#FF4D2E' }));
  });

  it('uses Instrument Serif italic at the chosen size', () => {
    renderWithProviders(<Wordmark size="lg" />);
    const root = screen.getByLabelText('Vouch.');
    const styles = Array.isArray(root.props.style) ? root.props.style : [root.props.style];
    const flat = Object.assign({}, ...styles);
    expect(flat.fontFamily).toBe('PlayfairDisplay_500Medium');
    expect(flat.fontSize).toBe(36);
  });

  it('supports the xl size for hero moments', () => {
    renderWithProviders(<Wordmark size="xl" />);
    const root = screen.getByLabelText('Vouch.');
    const styles = Array.isArray(root.props.style) ? root.props.style : [root.props.style];
    const flat = Object.assign({}, ...styles);
    expect(flat.fontSize).toBe(56);
  });

  it('defaults to ink color and overrides via color prop', () => {
    const { rerender } = renderWithProviders(<Wordmark />);
    const root = () => screen.getByLabelText('Vouch.');
    const flatStyle = () => {
      const s = root().props.style;
      const arr = Array.isArray(s) ? s : [s];
      return Object.assign({}, ...arr);
    };
    expect(flatStyle().color).toBe('#1A1410');
    rerender(<Wordmark color="#FFFFFF" />);
    expect(flatStyle().color).toBe('#FFFFFF');
  });
});
