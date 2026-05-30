import { Eyebrow, Face, PullQuote, StatusSpace } from '@/components';
import { SAMPLE_VALIDATION } from '@/features/feed/lib/fixtures';
import { log } from '@/lib/log';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

const CORAL = '#FF4D2E';
const PINK = '#FF3D87';
const INK = '#1A1410';
const MUTE = '#7A716A';
const TINT = '#FAF6F0';

/**
 * Validation modal (#14 of the redesign — Batch C). Surfaced when a friend
 * marks one of your recs as "used". For the design pass we mount this as a
 * modal route `/validation` and seed it with `SAMPLE_VALIDATION`. Real
 * push trigger lives in an edge function — pilot ships the surface only.
 */
export function ValidationScreen() {
  const router = useRouter();
  const v = SAMPLE_VALIDATION;

  useEffect(() => {
    log.event('validation.screen_entered');
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: TINT }}>
      <ScrollView contentContainerStyle={styles.body}>
        <StatusSpace />
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <Eyebrow color={PINK}>Just now ✦</Eyebrow>
        </View>

        <Text style={styles.headline}>
          {v.byFriend.name} used your <Text style={{ color: CORAL }}>{v.placeName}</Text> tip.
        </Text>

        {/* Friend card */}
        <View style={styles.friendCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Face uri={v.byFriend.avatarUri} size="md" />
            <View style={{ flex: 1 }}>
              <Text style={styles.friendName}>{v.byFriend.name}</Text>
              <Text style={styles.friendMeta}>{v.stayLabel}</Text>
            </View>
          </View>
          <View style={{ marginTop: 12 }}>
            <PullQuote size="md">{v.thankYou}</PullQuote>
          </View>
        </View>

        {/* Stat row */}
        <View style={styles.statRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>+{v.tripsPowered}</Text>
            <Text style={styles.statLabel}>trip your tips powered</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{v.recsUsedThisYear}</Text>
            <Text style={styles.statLabel}>friends used your recs this year</Text>
          </View>
        </View>

        <View style={{ flex: 1 }} />

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Say hi to ${v.byFriend.name}`}
          onPress={() => router.back()}
          style={styles.cta}
        >
          <Text style={styles.ctaLabel}>Say hi ←</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="See my impact"
          onPress={() => router.replace('/(tabs)/you' as never)}
          style={styles.ghost}
        >
          <Text style={styles.ghostLabel}>See my impact</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    flexGrow: 1,
    paddingHorizontal: 22,
    paddingTop: 8,
    paddingBottom: 28,
    gap: 16,
  },
  headline: {
    fontFamily: 'PlayfairDisplay_500Medium',
    fontSize: 32,
    lineHeight: 36,
    color: INK,
    letterSpacing: -0.8,
  },
  friendCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    marginTop: 8,
  },
  friendName: { fontFamily: 'DMSans_600SemiBold', fontSize: 15, color: INK },
  friendMeta: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 9,
    letterSpacing: 1.2,
    color: MUTE,
    marginTop: 4,
  },
  statRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
  },
  statValue: {
    fontFamily: 'PlayfairDisplay_500Medium',
    fontSize: 28,
    color: CORAL,
    letterSpacing: -0.6,
  },
  statLabel: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    color: MUTE,
    marginTop: 4,
  },
  cta: {
    backgroundColor: CORAL,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
  },
  ctaLabel: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 16,
    color: '#FFFFFF',
  },
  ghost: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  ghostLabel: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 13,
    color: MUTE,
  },
});
