import type { Profile } from '@/features/auth';

/**
 * Step ordering for the auth gate. Used to redirect mid-flow users back
 * to the right screen if they kill the app between steps.
 *
 * Redesign flow (Batch A):
 *   Welcome → Login → Framing → Circle → Taste-makers? → Import → Seed
 *
 * AuthGate enters at Welcome for unauthenticated; once a session exists
 * we infer how far they got from the profile shape.
 */
export const onboardingNextRoute = (profile: Profile | null): string => {
  if (!profile) return '/(auth)/framing';
  if (profile.onboarding_completed_at) return '/(tabs)/book';
  if (!profile.display_name) return '/(auth)/framing';
  if (!profile.home_city) return '/(auth)/framing';
  return '/(auth)/circle';
};
