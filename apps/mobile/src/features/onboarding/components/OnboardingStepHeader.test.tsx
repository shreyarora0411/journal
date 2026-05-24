import { fireEvent, renderWithProviders, screen } from '@/test/render';
import { OnboardingStepHeader } from './OnboardingStepHeader';

describe('OnboardingStepHeader', () => {
  it('renders only the step eyebrow by default (wordmark is opt-in)', () => {
    renderWithProviders(<OnboardingStepHeader step={1} total={4} />);
    expect(screen.queryByLabelText('lore.')).toBeNull();
    expect(screen.getByText('STEP 1 OF 4')).toBeTruthy();
  });

  it('renders the wordmark when showWordmark is true', () => {
    renderWithProviders(<OnboardingStepHeader step={1} total={4} showWordmark />);
    expect(screen.getByLabelText('lore.')).toBeTruthy();
  });

  it('does not render a back button by default', () => {
    renderWithProviders(<OnboardingStepHeader step={2} />);
    expect(screen.queryByLabelText('Back')).toBeNull();
  });

  it('renders a back button when showBack and calls onBack on press', () => {
    const onBack = jest.fn();
    renderWithProviders(<OnboardingStepHeader step={2} showBack onBack={onBack} />);
    fireEvent.press(screen.getByLabelText('Back'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
