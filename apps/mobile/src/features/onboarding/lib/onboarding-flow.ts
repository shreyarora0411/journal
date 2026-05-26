import type { Profile } from '@/features/auth';

/**
 * Step ordering for the auth gate.
 *
 * Pilot anti-drop-off variant: once a user has a session, we send them
 * straight to the Log screen. Display name + home city are filled in
 * later from the You tab — not as a gating step. The full onboarding
 * chain (Framing → Circle → Taste-makers) is no longer reachable from
 * the gate; those screens remain only as referenceable edit surfaces.
 */
export const onboardingNextRoute = (profile: Profile | null): string => {
  if (profile?.onboarding_completed_at) return '/(tabs)/book';
  return '/(tabs)/add';
};
