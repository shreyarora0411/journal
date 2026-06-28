import { StyleSheet, Text, View } from 'react-native';

const ACCENT = '#A8482F'; // terracotta — the design-system accent
const ACCENT_SOFT = 'rgba(168, 72, 47, 0.08)';
const INK = '#1A1410';

type Props = {
  voucherName: string;
  placeName: string;
  monthsAhead: number;
};

/**
 * "First in your network to vouch" badge — surfaced on a trip detail
 * header when the trip's author was the earliest voucher in the
 * viewer's circle AND their gap to the next voucher is meaningful
 * (>= 3 months, enforced by the caller).
 *
 * Hidden entirely when not applicable. The caller decides; this
 * component is presentational only.
 */
export function FirstVoucherBadge({ voucherName, placeName, monthsAhead }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.glyph}>✦</Text>
      <Text style={styles.label}>
        <Text style={styles.name}>{voucherName}</Text> was the first in your network to vouch for{' '}
        <Text style={styles.name}>{placeName}</Text> — {monthsAhead} month
        {monthsAhead === 1 ? '' : 's'} before anyone else
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: ACCENT_SOFT,
    borderWidth: 1,
    borderColor: ACCENT,
    borderStyle: 'solid',
  },
  glyph: {
    fontFamily: 'PlayfairDisplay_500Medium',
    fontSize: 16,
    color: ACCENT,
    lineHeight: 20,
  },
  label: {
    flex: 1,
    fontFamily: 'PlayfairDisplay_500Medium_Italic',
    fontSize: 14.5,
    lineHeight: 21,
    color: INK,
  },
  name: {
    fontFamily: 'PlayfairDisplay_500Medium',
    color: ACCENT,
  },
});
