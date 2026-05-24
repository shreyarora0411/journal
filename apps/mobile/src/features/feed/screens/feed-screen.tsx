import {
  CategoryPill,
  Eyebrow,
  Face,
  Page,
  Photo,
  PullQuote,
  StatusSpace,
  Wordmark,
} from '@/components';
import { log } from '@/lib/log';
import { Link, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FRIEND_RECS, type FriendRec, LIVE_TRAVELERS, type LiveTraveler } from '../lib/fixtures';

const CORAL = '#FF4D2E';
const PINK = '#FF3D87';
const INK = '#1A1410';
const MUTE = '#7A716A';
const TINT = '#FAF6F0';
const HAIR = '#EFEAE2';

/**
 * Feed (#07 of the redesign — Batch B). The home tab.
 *
 * Layout per the brief:
 *   - Header: lore. wordmark left, search + avatar right
 *   - "Right now" horizontal strip — friends currently traveling
 *   - Full-width recommendation cards, friend-first (face + name + when)
 *     before the place name. Rule 1 of the design system.
 */
export function FeedScreen() {
  const router = useRouter();

  useEffect(() => {
    log.event('feed.screen_entered');
  }, []);

  return (
    <Page>
      <StatusSpace />

      {/* Header */}
      <View style={styles.header}>
        <Wordmark size="md" />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Link href="/(tabs)/search" asChild>
            <Pressable accessibilityRole="button" accessibilityLabel="Search">
              <Text style={styles.headerGlyph}>⌕</Text>
            </Pressable>
          </Link>
          <Link href="/(tabs)/you" asChild>
            <Pressable accessibilityRole="button" accessibilityLabel="Your profile">
              <Face initials="ME" size="sm" />
            </Pressable>
          </Link>
        </View>
      </View>

      {/* Right now strip */}
      <View style={{ marginTop: 16 }}>
        <Eyebrow color={PINK}>Right now</Eyebrow>
        <View style={styles.liveStrip}>
          {LIVE_TRAVELERS.map((t) => (
            <LiveCard
              key={t.id}
              traveler={t}
              onPress={() => router.push(`/destination/${t.destinationSlug}` as never)}
            />
          ))}
        </View>
      </View>

      {/* Fresh from my circle */}
      <View style={{ marginTop: 24, gap: 16 }}>
        <Eyebrow>Fresh from my circle</Eyebrow>
        {FRIEND_RECS.map((r) => (
          <RecCard
            key={r.id}
            rec={r}
            onPress={() => router.push(`/place/${idFromRec(r)}` as never)}
          />
        ))}
      </View>
    </Page>
  );
}

function idFromRec(r: FriendRec): string {
  // Only one place detail is wired in fixtures for now; everything else
  // links to the Hotel K5 detail. Replace with a real lookup in Phase final.
  if (r.placeName === 'Hotel K5') return 'hotel-k5';
  return 'hotel-k5';
}

function LiveCard({ traveler, onPress }: { traveler: LiveTraveler; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${traveler.name} is in ${traveler.destination}, day ${traveler.dayNumber}`}
      onPress={onPress}
      style={styles.liveCard}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Face uri={traveler.avatarUri} size="sm" />
        <View style={styles.liveDot} />
      </View>
      <View style={{ flex: 1, marginLeft: 4 }}>
        <Text style={styles.liveName}>{traveler.name}</Text>
        <Text style={styles.liveSub}>
          {traveler.destination} · Day {traveler.dayNumber}
        </Text>
      </View>
      <View style={styles.liveAsk}>
        <Text style={styles.liveAskLabel}>Ask →</Text>
      </View>
    </Pressable>
  );
}

function RecCard({ rec, onPress }: { rec: FriendRec; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${rec.friend.name}'s rec for ${rec.placeName}`}
      onPress={onPress}
      style={styles.recCard}
    >
      {/* Friend row — face + name + when. Always above the place name (rule 1). */}
      <View style={styles.friendRow}>
        <Face uri={rec.friend.avatarUri} size="sm" />
        <View style={{ flex: 1 }}>
          <Text style={styles.friendName}>{rec.friend.name}</Text>
          <Text style={styles.friendWhen}>{rec.when}</Text>
        </View>
      </View>

      {/* Photo with category pill overlay */}
      <Photo uri={rec.coverUri} aspectRatio={4 / 3} radius={14}>
        <View style={styles.categoryOverlay}>
          <CategoryPill category={rec.category} variant="soft" />
        </View>
      </Photo>

      {/* Place name + area + pull quote */}
      <View style={{ marginTop: 12, gap: 6 }}>
        <Text style={styles.placeName}>{rec.placeName}</Text>
        <Text style={styles.area}>{rec.area}</Text>
        <PullQuote size="sm">{rec.quote}</PullQuote>
      </View>

      {/* Footer */}
      <View style={styles.recFooter}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text style={styles.heart}>♥</Text>
          <Text style={styles.heartCount}>{rec.hearts}</Text>
        </View>
        <Text style={styles.saveGlyph}>⌃</Text>
        <Text style={styles.addPlan}>Add to plan</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
  },
  headerGlyph: { fontSize: 22, color: INK },
  liveStrip: { gap: 10, marginTop: 12 },
  liveCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: TINT,
    borderRadius: 16,
  },
  liveDot: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: PINK,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  liveName: { fontFamily: 'Geist_500Medium', fontSize: 14, color: INK },
  liveSub: { fontFamily: 'Geist_400Regular', fontSize: 12, color: MUTE, marginTop: 2 },
  liveAsk: {
    backgroundColor: INK,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  liveAskLabel: { fontFamily: 'Geist_500Medium', fontSize: 12, color: '#FFFFFF' },
  recCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingTop: 12,
    paddingBottom: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: HAIR,
  },
  friendRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  friendName: { fontFamily: 'Geist_500Medium', fontSize: 14, color: INK },
  friendWhen: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 9,
    letterSpacing: 1.2,
    color: MUTE,
    marginTop: 2,
  },
  categoryOverlay: { position: 'absolute', top: 10, left: 10 },
  placeName: { fontFamily: 'Geist_500Medium', fontSize: 16, color: INK },
  area: { fontFamily: 'Geist_400Regular', fontSize: 12, color: MUTE },
  recFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: HAIR,
  },
  heart: { fontSize: 14, color: CORAL },
  heartCount: { fontFamily: 'Geist_500Medium', fontSize: 12, color: INK },
  saveGlyph: { fontSize: 16, color: MUTE },
  addPlan: { fontFamily: 'Geist_500Medium', fontSize: 13, color: CORAL, marginLeft: 'auto' },
});
