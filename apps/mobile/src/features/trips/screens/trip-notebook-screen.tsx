import { CategoryPill, Eyebrow, Face, Photo, PullQuote } from '@/components';
import { type NotebookEntry, getTrip } from '@/features/feed/lib/fixtures';
import { log } from '@/lib/log';
import { CATEGORIES } from '@/theme';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const CORAL = '#FF4D2E';
const INK = '#1A1410';
const MUTE = '#7A716A';
const TINT = '#FAF6F0';
const HAIR = '#EFEAE2';

/**
 * Trip notebook (#11 of the redesign — Batch C). New file alongside the
 * legacy `trip-detail-screen.tsx`. Routed via `/trip-notebook/[id]`.
 *
 * Layout per the brief:
 *   - Eyebrow: month label + duration
 *   - Italic-serif title naming the trip owner ("Kabir is in Tokyo.")
 *   - Meta line: face + entries / photos / friends-stole-tips
 *   - Map glance card: 4 numbered pins on a horizontal line
 *   - Vertical timeline with a hairline spine: round category dot + photo
 *     card with place name, day eyebrow, italic-serif quote
 */
export function TripNotebookScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const trip = useMemo(() => getTrip(id ?? ''), [id]);

  useEffect(() => {
    log.event('trip.notebook_entered', { id });
  }, [id]);

  if (!trip) {
    return (
      <View style={{ flex: 1, backgroundColor: '#FFFFFF', padding: 24 }}>
        <Text style={{ color: MUTE }}>Trip not found.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#FFFFFF' }}
      contentContainerStyle={{ paddingBottom: 96 }}
    >
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => router.back()}
          style={styles.backPill}
        >
          <Text style={styles.backGlyph}>‹</Text>
        </Pressable>
      </View>

      <View style={{ paddingHorizontal: 22 }}>
        <Eyebrow>{`${trip.monthLabel} · ${trip.days} days`}</Eyebrow>
        <Text style={styles.title}>
          {trip.ownerName} is in <Text style={{ color: CORAL }}>{trip.destination}</Text>.
        </Text>

        {/* Meta line */}
        <View style={styles.metaRow}>
          <Face uri={trip.ownerAvatarUri} size="sm" />
          <Text style={styles.meta}>
            {trip.entryCount} entries · {trip.photoCount} photos · {trip.tipsUsedByFriends} friends
            stole tips
          </Text>
        </View>

        {/* Map glance card */}
        <View style={styles.mapCard}>
          <View style={styles.pinRow}>
            <View style={styles.pinSpine} />
            {trip.pins.map((p) => (
              <View key={p.idx} style={[styles.pin, { backgroundColor: p.color }]}>
                <Text style={styles.pinIdx}>{p.idx}</Text>
              </View>
            ))}
          </View>
          <View style={styles.pinLabelsRow}>
            {trip.pins.map((p) => (
              <Text key={p.idx} style={styles.pinLabel} numberOfLines={1}>
                {p.label}
              </Text>
            ))}
          </View>
        </View>
      </View>

      {/* Timeline */}
      <View style={{ paddingHorizontal: 22, marginTop: 24 }}>
        <Eyebrow>Timeline</Eyebrow>
        <View style={{ marginTop: 16 }}>
          {trip.entries.map((e, i) => (
            <TimelineRow
              key={e.id}
              entry={e}
              isLast={i === trip.entries.length - 1}
              onPress={() => router.push('/(tabs)/place/hotel-k5' as never)}
            />
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

function TimelineRow({
  entry,
  isLast,
  onPress,
}: {
  entry: NotebookEntry;
  isLast: boolean;
  onPress: () => void;
}) {
  const color = CATEGORIES[entry.category].color;
  return (
    <View style={styles.timelineRow}>
      {/* Hairline spine + colored category dot */}
      <View style={styles.spineCol}>
        <View style={[styles.categoryDot, { backgroundColor: color }]} />
        {!isLast ? <View style={styles.spineLine} /> : null}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={entry.placeName}
        onPress={onPress}
        style={styles.entryCard}
      >
        <Photo uri={entry.photoUri} aspectRatio={16 / 9} radius={12}>
          <View style={{ position: 'absolute', top: 10, left: 10 }}>
            <CategoryPill category={entry.category} variant="soft" />
          </View>
        </Photo>
        <View style={{ marginTop: 10 }}>
          <Text style={styles.entryPlace}>{entry.placeName}</Text>
          <Text style={styles.entryArea}>{entry.area}</Text>
          <Text style={styles.entryDay}>{entry.dayLabel.toUpperCase()}</Text>
          <PullQuote size="sm">{entry.quote}</PullQuote>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 22,
    paddingBottom: 4,
  },
  backPill: {
    alignSelf: 'flex-start',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: TINT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backGlyph: {
    fontFamily: 'PlayfairDisplay_500Medium',
    fontSize: 22,
    color: INK,
  },
  title: {
    fontFamily: 'PlayfairDisplay_500Medium',
    fontSize: 38,
    lineHeight: 42,
    color: INK,
    letterSpacing: -1,
    marginTop: 12,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
  },
  meta: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    color: MUTE,
    flex: 1,
  },
  mapCard: {
    marginTop: 20,
    backgroundColor: TINT,
    borderRadius: 18,
    padding: 16,
  },
  pinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 28,
    position: 'relative',
  },
  pinSpine: {
    position: 'absolute',
    left: 14,
    right: 14,
    height: 1,
    // Dashed coral hairline connecting the pins
    backgroundColor: 'transparent',
    borderStyle: 'dashed',
    borderTopWidth: 1,
    borderColor: CORAL,
    opacity: 0.45,
  },
  pin: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  pinIdx: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 12,
    color: '#FFFFFF',
  },
  pinLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  pinLabel: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 9,
    letterSpacing: 1.0,
    color: MUTE,
    flex: 1,
    textAlign: 'center',
  },
  timelineRow: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 16,
  },
  spineCol: {
    width: 14,
    alignItems: 'center',
    paddingTop: 12,
  },
  categoryDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  spineLine: {
    width: 1,
    flex: 1,
    backgroundColor: HAIR,
    marginTop: 6,
  },
  entryCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: HAIR,
    borderRadius: 14,
    padding: 12,
  },
  entryPlace: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 16,
    color: INK,
  },
  entryArea: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    color: MUTE,
  },
  entryDay: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 9,
    letterSpacing: 1.4,
    color: MUTE,
    marginTop: 6,
  },
});
