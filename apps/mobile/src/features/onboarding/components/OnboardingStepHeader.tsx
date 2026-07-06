import { Eyebrow } from '@/components/Eyebrow';
import { Wordmark } from '@/components/Wordmark';
import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

type Props = {
  step: number;
  total?: number;
  showBack?: boolean;
  onBack?: () => void;
  /**
   * Whether to render the `lore.` wordmark above the step eyebrow. Defaults
   * to true; pass `false` on every step after #1 so the brand isn't shouting
   * from the top of every onboarding screen. The eyebrow + the new italic
   * serif headline already carry it.
   */
  showWordmark?: boolean;
};

/**
 * Onboarding header for the 4-step flow. Renders the back arrow (optional),
 * the lore wordmark (optional — first step only by convention), and the
 * `STEP N OF M` eyebrow.
 */
export function OnboardingStepHeader({
  step,
  total = 4,
  showBack = false,
  onBack,
  showWordmark = false,
}: Props) {
  const router = useRouter();
  // No onBack means "this is the top of a Stack screen" — fall back to the
  // router's own back() rather than leaving the visible chevron dead.
  const handleBack = onBack ?? (() => router.back());
  return (
    <View style={{ paddingTop: 8, gap: 16 }}>
      {showBack ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={handleBack}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={{ alignSelf: 'flex-start' }}
        >
          <Text
            style={{
              fontFamily: 'PlayfairDisplay_500Medium',
              fontSize: 26,
              lineHeight: 26,
              color: '#1A1410',
            }}
          >
            ‹
          </Text>
        </Pressable>
      ) : null}
      {showWordmark ? <Wordmark size="md" color="#1A1410" /> : null}
      <Eyebrow>{`Step ${step} of ${total}`}</Eyebrow>
    </View>
  );
}
