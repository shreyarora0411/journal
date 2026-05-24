import { CATEGORIES, type Category, theme } from '.';

describe('theme tokens (lore redesign)', () => {
  it('exposes the new core surface and accent colors', () => {
    expect(theme.colors.bg).toBe('#FFFFFF');
    expect(theme.colors.tint).toBe('#FAF6F0');
    expect(theme.colors.ink).toBe('#1A1410');
    expect(theme.colors.mute).toBe('#7A716A');
    expect(theme.colors.hair).toBe('#EFEAE2');
    expect(theme.colors.coral).toBe('#FF4D2E');
  });

  it('exposes the four category marker colors', () => {
    expect(theme.colors.pink).toBe('#FF3D87');
    expect(theme.colors.emerald).toBe('#00A67E');
    expect(theme.colors.gold).toBe('#FFB300');
  });

  it('uses InstrumentSerif italic for display, title, heading, and quote variants', () => {
    expect(theme.textVariants.display.fontFamily).toBe('InstrumentSerif_400Italic');
    expect(theme.textVariants.title.fontFamily).toBe('InstrumentSerif_400Italic');
    expect(theme.textVariants.heading.fontFamily).toBe('InstrumentSerif_400Italic');
    expect(theme.textVariants.quote.fontFamily).toBe('InstrumentSerif_400Italic');
  });

  it('uses Geist for body and caption', () => {
    expect(theme.textVariants.body.fontFamily).toBe('Geist_400Regular');
    expect(theme.textVariants.caption.fontFamily).toBe('Geist_400Regular');
    expect(theme.textVariants.headline.fontFamily).toBe('Geist_500Medium');
  });

  it('uses JetBrainsMono for the eyebrow + label variants', () => {
    expect(theme.textVariants.eyebrow.fontFamily).toBe('JetBrainsMono_400Regular');
    expect(theme.textVariants.label.fontFamily).toBe('JetBrainsMono_400Regular');
    expect(theme.textVariants.eyebrow.letterSpacing).toBe(1.4);
  });

  it('uses pill (999) radius for buttons by default', () => {
    expect(theme.borderRadii.pill).toBe(999);
    expect(theme.buttonVariants.defaults.borderRadius).toBe('pill');
  });

  it('maps each of the five categories to its color', () => {
    const expected: Category[] = ['stay', 'food', 'drinks', 'wander', 'buy'];
    for (const c of expected) {
      expect(CATEGORIES[c]).toBeDefined();
      expect(CATEGORIES[c].color).toMatch(/^(#[0-9A-F]{6}|rgba)/i);
    }
    expect(CATEGORIES.stay.color).toBe('#FF4D2E');
    expect(CATEGORIES.food.color).toBe('#FF3D87');
    expect(CATEGORIES.drinks.color).toBe('#00A67E');
    expect(CATEGORIES.wander.color).toBe('#FFB300');
  });
});
