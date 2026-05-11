import { Box, Text } from '@/components';
import { useRouter } from 'expo-router';
import { Pressable } from 'react-native';

type Props = {
  step: number;
  total?: number;
  /** Shown on the right when provided. Tapping calls `onSkip` (or skipHref). */
  onSkip?: () => void;
  /** Optional override for the back action. Defaults to router.back(). */
  onBack?: () => void;
};

/**
 * Onboarding step indicator. Per design pack screens 04–07:
 *   ┌─ ← ─ Step 1 of 4 ─ Skip? ─┐
 *
 * Back button on the left, centered step label, optional Skip on the right.
 */
export function StepIndicator({ step, total = 4, onSkip, onBack }: Props) {
  const router = useRouter();
  return (
    <Box flexDirection="row" alignItems="center" justifyContent="space-between" paddingVertical="s">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        onPress={onBack ?? (() => router.back())}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        style={{ width: 32, alignItems: 'flex-start' }}
      >
        <Text variant="body" fontFamily="Fraunces_400" fontSize={20}>
          ‹
        </Text>
      </Pressable>
      <Text variant="caption">
        Step {step} of {total}
      </Text>
      <Box width={32} alignItems="flex-end">
        {onSkip ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Skip"
            onPress={onSkip}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text variant="caption">Skip</Text>
          </Pressable>
        ) : null}
      </Box>
    </Box>
  );
}
