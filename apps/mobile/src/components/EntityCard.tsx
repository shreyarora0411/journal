import { formatVouchDate } from '@/lib/format-vouch-date';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

const INK = '#1A1410';
const MUTE = '#7A716A';
const FAINT = '#B7AE9F';
const HAIR = '#EFEAE2';
const CARD = '#FFFFFF';

type Props = {
  /** Entity name — bold, primary text. e.g. "Senhora do Monte". */
  name: string;
  /** Area or sub-location e.g. "Lakeside, Pokhara". Optional. */
  area?: string | null;
  /** Friend's exact quote — rendered italic in quotation marks. */
  quote?: string | null;
  /** Voucher's display name. When null, the attribution row is hidden
   *  entirely (some sources don't carry it — e.g. the current
   *  search_friend_graph RPC). */
  voucherName?: string | null;
  /** Vouch timestamp — formatted via formatVouchDate. The stale
   *  freshness flag triggers ~70% opacity on the date label so old
   *  vouches don't read with the same authority. */
  vouchedAt?: Date | null;
  /** Optional left-side glyph (search uses category letters). */
  glyph?: ReactNode;
  /** Optional right-side affordance (chevron, etc). */
  rightSlot?: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
};

/**
 * Shared entity card — one component for venue/area/tip surfaces.
 *
 * Round 2 validator-thesis pass: every entity card shows the voucher
 * (who put their reputation behind this) + the freshness date (when
 * the vouch was made). Both fields are optional because some sources
 * don't yet carry them (search_friend_graph returns trip_user_id but
 * not the joined display_name — to be fixed in a follow-up migration).
 *
 * Visual order, top to bottom:
 *   1. Entity name (bold, Playfair Medium)
 *   2. Area / sub-location (small, DM Sans, muted)
 *   3. Italic quote in quotation marks
 *   4. Voucher attribution — uppercase, tracked, tertiary text
 *      e.g. "MIRA · APRIL 2026"
 */
export function EntityCard({
  name,
  area,
  quote,
  voucherName,
  vouchedAt,
  glyph,
  rightSlot,
  onPress,
  accessibilityLabel,
}: Props) {
  const dateLabel = vouchedAt ? formatVouchDate(vouchedAt) : null;
  const attribution = voucherName
    ? dateLabel
      ? `${voucherName.toUpperCase()} · ${dateLabel.display.toUpperCase()}`
      : voucherName.toUpperCase()
    : null;
  const Container = onPress ? Pressable : View;

  return (
    <Container
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel ?? name}
      style={styles.card}
    >
      {glyph ? <View style={styles.glyphSlot}>{glyph}</View> : null}
      <View style={{ flex: 1 }}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        {area ? (
          <Text style={styles.area} numberOfLines={1}>
            {area}
          </Text>
        ) : null}
        {quote ? (
          <Text style={styles.quote} numberOfLines={2}>
            "{quote}"
          </Text>
        ) : null}
        {attribution ? (
          <Text
            style={[
              styles.attribution,
              dateLabel?.freshness === 'stale' && styles.attributionStale,
            ]}
          >
            {attribution}
          </Text>
        ) : null}
      </View>
      {rightSlot ? <View style={styles.rightSlot}>{rightSlot}</View> : null}
    </Container>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: HAIR,
  },
  glyphSlot: { paddingTop: 2 },
  name: {
    fontFamily: 'PlayfairDisplay_500Medium',
    fontSize: 20,
    color: INK,
    letterSpacing: -0.4,
  },
  area: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12.5,
    color: MUTE,
    marginTop: 2,
  },
  quote: {
    fontFamily: 'PlayfairDisplay_500Medium_Italic',
    fontSize: 14.5,
    lineHeight: 21,
    color: INK,
    marginTop: 8,
  },
  attribution: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 10,
    letterSpacing: 1.3,
    color: FAINT,
    marginTop: 10,
  },
  attributionStale: { opacity: 0.7 },
  rightSlot: { paddingTop: 4 },
});
