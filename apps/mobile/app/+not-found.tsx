import { Redirect } from 'expo-router';

/**
 * Unmatched routes (stale deep links, legacy screens, malformed invite
 * URLs) land on the map instead of stranding the user on a dead screen.
 */
export default function NotFound() {
  return <Redirect href="/(tabs)/book" />;
}
