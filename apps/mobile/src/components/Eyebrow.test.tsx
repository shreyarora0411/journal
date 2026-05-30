import { renderWithProviders, screen } from '@/test/render';
import { Eyebrow } from './Eyebrow';

describe('Eyebrow', () => {
  it('renders an uppercase mono label with the leading dot', () => {
    renderWithProviders(<Eyebrow>step 1 of 4</Eyebrow>);
    expect(screen.getByText('STEP 1 OF 4')).toBeTruthy();
    expect(screen.getByTestId('eyebrow-dot')).toBeTruthy();
  });

  it('defaults the dot + text to coral', () => {
    renderWithProviders(<Eyebrow>hi</Eyebrow>);
    const dot = screen.getByTestId('eyebrow-dot');
    expect(dot.props.style).toEqual(expect.objectContaining({ backgroundColor: '#FF4D2E' }));
  });

  it('honors the color prop on dot and label', () => {
    renderWithProviders(<Eyebrow color="#FF3D87">FROM INSTAGRAM</Eyebrow>);
    expect(screen.getByTestId('eyebrow-dot').props.style).toEqual(
      expect.objectContaining({ backgroundColor: '#FF3D87' }),
    );
    const label = screen.getByText('FROM INSTAGRAM');
    const styles = Array.isArray(label.props.style) ? label.props.style : [label.props.style];
    const flat = Object.assign({}, ...styles);
    expect(flat.color).toBe('#FF3D87');
  });

  it('uses JetBrains Mono at 10px with 1.4 letter-spacing', () => {
    renderWithProviders(<Eyebrow>x</Eyebrow>);
    const label = screen.getByText('X');
    const styles = Array.isArray(label.props.style) ? label.props.style : [label.props.style];
    const flat = Object.assign({}, ...styles);
    expect(flat.fontFamily).toBe('DMSans_700Bold');
    expect(flat.fontSize).toBe(10);
    expect(flat.letterSpacing).toBe(1.4);
  });
});
