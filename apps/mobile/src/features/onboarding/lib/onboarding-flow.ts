import type { Profile } from '@/features/auth';

/**
 * Auth-gate routing for the pilot onboarding flow:
 *
 *   Welcome → Login → Framing (name) → Circle (contacts) → Feed
 *
 * Once a session exists we infer the next step from the profile shape:
 *   - no display_name        → /(auth)/framing
 *   - has name, not completed → /(auth)/circle
 *   - onboarding_completed_at → /(tabs)/book
 *
 * The taste-makers fallback and the home-city / bio fields from the
 * earlier multi-step flow are deferred to a post-onboarding "edit
 * profile" surface — they bleed the funnel without raising activation.
 */
export const onboardingNextRoute = (profile: Profile | null): string => {
  if (profile?.onboarding_completed_at) return '/(tabs)/book';
  if (!profile?.display_name) return '/(auth)/framing';
  return '/(auth)/circle';
};
