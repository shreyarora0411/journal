import { renderWithProviders, screen } from '@/test/render';
import { CountryPill } from './CountryPill';

describe('CountryPill', () => {
  it('renders +91 dial code and chevron — no flag emoji (tofu in custom fonts)', () => {
    renderWithProviders(<CountryPill />);
    expect(screen.queryByText('🇮🇳')).toBeNull();
    expect(screen.getByText('+91')).toBeTruthy();
    expect(screen.getByText('▾')).toBeTruthy();
  });

  it('is rendered as a disabled button for now', () => {
    renderWithProviders(<CountryPill />);
    const pill = screen.getByLabelText('Country: India');
    expect(pill.props.accessibilityState?.disabled).toBe(true);
  });
});
