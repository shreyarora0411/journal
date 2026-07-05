import * as Haptics from 'expo-haptics';

// The native module can throw (or simply be missing) on a simulator, or on a
// device that hasn't picked up this dependency via a fresh prebuild yet — a
// nice-to-have must never break the interaction it's decorating.
const fireAndForget = (run: () => Promise<void>) => {
  try {
    run().catch(() => undefined);
  } catch {
    // no-op — see comment above
  }
};

/** The one deliberate, weightier tap in the app (e.g. choosing a sentiment). */
export const hapticImpactMedium = () =>
  fireAndForget(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));

/** Routine, high-frequency taps (e.g. tab-bar navigation). */
export const hapticImpactLight = () =>
  fireAndForget(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));

/** A goal met — save succeeded, a gate crossed, a taste revealed. */
export const hapticSuccess = () =>
  fireAndForget(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
