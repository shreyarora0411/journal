import type { Profile } from '@/features/auth';

/**
 * Auth-gate routing for the pilot onboarding flow:
 *
 *   Welcome → Login → Framing (name) → Taste setup (quiz + pick-5) → Feed
 *
 * Once a session exists we infer the next step from the profile shape:
 *   - no display_name        → /(auth)/framing
 *   - has name, not completed → /(tabs)/taste-setup
 *   - onboarding_completed_at → /(tabs)/book
 *
 * Circle (contacts) is cut from the launch path: with a cold-start corpus,
 * it burns the one-time iOS contacts permission for a near-guaranteed zero
 * matches. It stays in the codebase as a later re-entry point (Friends tab)
 * for once contact matching can actually succeed; taste-setup-screen.tsx now
 * marks onboarding_completed on finish so this fallback is only ever hit
 * mid-flow, never after completion.
 *
 * The taste-makers fallback and the home-city / bio fields from the
 * earlier multi-step flow are deferred to a post-onboarding "edit
 * profile" surface — they bleed the funnel without raising activation.
 */
export const onboardingNextRoute = (profile: Profile | null): string => {
  if (profile?.onboarding_completed_at) return '/(tabs)/book';
  if (!profile?.display_name) return '/(auth)/framing';
  return '/(tabs)/taste-setup';
};
