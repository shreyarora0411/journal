import type { Profile } from '@/features/auth';

/**
 * Step ordering for the auth gate. Used to redirect mid-flow users back to
 * the right screen if they kill the app between steps.
 *
 * `framing` — display_name not yet set
 * `instagram` — display_name set, Instagram step pending (the rest are optional)
 */
export const onboardingNextRoute = (profile: Profile | null): string => {
  if (!profile) return '/(auth)/framing';
  if (profile.onboarding_completed_at) return '/(tabs)/book';
  if (!profile.display_name) return '/(auth)/framing';
  return '/(auth)/instagram';
};
