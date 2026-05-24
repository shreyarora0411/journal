import { renderWithProviders, screen } from '@/test/render';
import { CategoryPill } from './CategoryPill';

describe('CategoryPill', () => {
  it('renders the uppercase category label', () => {
    renderWithProviders(<CategoryPill category="stay" />);
    expect(screen.getByText('STAY')).toBeTruthy();
  });

  it.each([
    ['stay', '#FF4D2E'] as const,
    ['food', '#FF3D87'] as const,
    ['drinks', '#00A67E'] as const,
    ['wander', '#FFB300'] as const,
  ])('maps %s to its color', (cat, color) => {
    renderWithProviders(<CategoryPill category={cat} />);
    const label = screen.getByText(cat.toUpperCase());
    const styles = Array.isArray(label.props.style) ? label.props.style : [label.props.style];
    const flat = Object.assign({}, ...styles);
    expect(flat.color).toBe(color);
  });

  it('filled variant uses white text on the category color background', () => {
    renderWithProviders(<CategoryPill category="stay" variant="filled" />);
    const label = screen.getByText('STAY');
    const styles = Array.isArray(label.props.style) ? label.props.style : [label.props.style];
    const flat = Object.assign({}, ...styles);
    expect(flat.color).toBe('#FFFFFF');
  });
});
