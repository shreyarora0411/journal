import { Redirect } from 'expo-router';

// Legacy trip-era route — dead-ends into the Book tab post taste-pivot.
export default function LegacyRedirect() {
  return <Redirect href="/(tabs)/book" />;
}
