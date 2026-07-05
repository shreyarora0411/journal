import { Pressable, StyleSheet, Text } from 'react-native';
import { CARD, CORAL, HAIR, MUTE, SANS, SANS_SEMI } from '../lib/taste-tokens';

/**
 * The honest failure state. A query error must never be dressed up as an
 * empty graph ("nothing loved here yet") — that lies about the world and
 * invites redundant logging. Say it failed, offer the retry.
 */
export function LoadError({
  message = "Couldn't load this.",
  onRetry,
}: {
  message?: string;
  onRetry: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Retry loading"
      onPress={onRetry}
      style={styles.card}
    >
      <Text style={styles.message}>{message}</Text>
      <Text style={styles.retry}>Tap to retry</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 16,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: HAIR,
    backgroundColor: CARD,
    gap: 4,
  },
  message: { fontFamily: SANS, fontSize: 13.5, color: MUTE },
  retry: { fontFamily: SANS_SEMI, fontSize: 13.5, color: CORAL },
});
