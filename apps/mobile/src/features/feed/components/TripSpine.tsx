import { Box, Text } from '@/components';
import { SignedPhoto } from '@/features/trips/components/SignedPhoto';
import { photoColor } from '@/theme';
import { Link } from 'expo-router';
import { Pressable } from 'react-native';

type Props = {
  tripId: string;
  title: string;
  /** YYYY-MM or YYYY-MM-DD style. We'll truncate to month. */
  startDate?: string | null;
  /** Optional cover photo path (storage_path). */
  coverPath?: string | null;
};

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

const formatMonth = (iso?: string | null): string => {
  if (!iso) return '';
  const [y, m] = iso.split('-');
  if (!y || !m) return '';
  const monthIdx = Number(m) - 1;
  if (monthIdx < 0 || monthIdx > 11) return '';
  return `${MONTH_NAMES[monthIdx]} ${y.slice(2)}`;
};

/**
 * The "Book strip" tile from Postmark brief §6 (screen 09).
 * 60px wide column: color photo (or signed photo if available) +
 * Fraunces title + meta date. Tappable, routes to the trip.
 */
export function TripSpine({ tripId, title, startDate, coverPath }: Props) {
  const color = photoColor(tripId);
  return (
    <Link href={`/trip/${tripId}`} asChild>
      <Pressable>
        <Box width={64}>
          {coverPath ? (
            <SignedPhoto
              storagePath={coverPath}
              aspect={3 / 4}
              maxWidth={64}
              accessibilityLabel={title}
            />
          ) : (
            <Box style={{ width: 64, height: 80, backgroundColor: color, borderRadius: 6 }} />
          )}
          <Text variant="placeName" marginTop="xs" numberOfLines={1}>
            {title}
          </Text>
          {startDate ? (
            <Text variant="meta" numberOfLines={1}>
              {formatMonth(startDate)}
            </Text>
          ) : null}
        </Box>
      </Pressable>
    </Link>
  );
}
