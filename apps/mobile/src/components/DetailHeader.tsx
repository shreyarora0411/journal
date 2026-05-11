import { Box, Text } from '@/components';
import { useRouter } from 'expo-router';
import { Pressable } from 'react-native';

type Props = {
  /** Optional centered title. Omit for a chromeless back-only header. */
  title?: string;
  /** Right-side slot (rare — used for share/star/etc.). */
  right?: React.ReactNode;
  /** Override the default back handler (router.back()). */
  onBack?: () => void;
};

/**
 * Standard header for non-tab screens (trip detail, place, list, friend
 * profile, map, year-in-travel). Renders a back arrow on the left so the
 * user can return without a hardware back button.
 *
 * Tab bar is preserved because these routes live inside (tabs).
 */
export function DetailHeader({ title, right, onBack }: Props) {
  const router = useRouter();
  return (
    <Box
      flexDirection="row"
      alignItems="center"
      justifyContent="space-between"
      paddingHorizontal="m"
      paddingVertical="s"
      style={{
        borderBottomWidth: 0.5,
        borderColor: 'rgba(0,0,0,0.08)',
        backgroundColor: '#FAF8F3',
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        onPress={onBack ?? (() => router.back())}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        style={{ width: 44, alignItems: 'flex-start' }}
      >
        <Text style={{ fontFamily: 'Fraunces_400', fontSize: 22, lineHeight: 22 }}>‹</Text>
      </Pressable>
      <Box flex={1} alignItems="center">
        {title ? (
          <Text variant="body" fontFamily="Inter_500Medium" numberOfLines={1}>
            {title}
          </Text>
        ) : null}
      </Box>
      <Box style={{ width: 44, alignItems: 'flex-end' }}>{right}</Box>
    </Box>
  );
}
