import { Eyebrow, Face, Page, Photo, PullQuote, StatusSpace } from '@/components';
import { ME } from '@/features/feed/lib/fixtures';
import { log } from '@/lib/log';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

const CORAL = '#FF4D2E';
const GOLD = '#FFB300';
const INK = '#1A1410';
const MUTE = '#7A716A';
const TINT = '#FAF6F0';
const HAIR = '#EFEAE2';

/**
 * Profile · Travel book (#12 of the redesign — Batch C).
 *
 * Layout per the brief:
 *   - 68pt face + name + handle + settings cog
 *   - Italic-serif tagline pull quote
 *   - 3-stat row (white outlined / tinted / coral-filled)
 *   - Coral→gold gradient "My 2026, so far" Wrapped teaser
 *   - 2-column photo grid of trip cards
 */
export function ProfileScreen() {
  const router = useRouter();

  useEffect(() => {
    log.event('profile.screen_entered');
  }, []);

  return (
    <Page>
      <StatusSpace />

      {/* Header — face + name + cog */}
      <View style={styles.header}>
        <Face uri={ME.avatarUri} size="lg" />
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{ME.name}</Text>
          <Text style={styles.handle}>{ME.handle}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Settings">
          <Text style={styles.cog}>⚙︎</Text>
        </Pressable>
      </View>

      {/* Tagline */}
      <View style={{ marginTop: 16 }}>
        <PullQuote size="sm" color={MUTE}>
          {ME.tagline}
        </PullQuote>
      </View>

      {/* 3-stat row */}
      <View style={styles.statRow}>
        <View style={[styles.stat, styles.statOutlined]}>
          <Text style={[styles.statValue, { color: INK }]}>{ME.trips}</Text>
          <Text style={[styles.statLabel, { color: MUTE }]}>Trips</Text>
        </View>
        <View style={[styles.stat, styles.statTinted]}>
          <Text style={[styles.statValue, { color: INK }]}>{ME.countries}</Text>
          <Text style={[styles.statLabel, { color: MUTE }]}>Countries</Text>
        </View>
        <View style={[styles.stat, styles.statFilled]}>
          <Text style={[styles.statValue, { color: '#FFFFFF' }]}>{ME.tipsGiven}</Text>
          <Text style={[styles.statLabel, { color: '#FFFFFF', opacity: 0.85 }]}>Tips I gave</Text>
        </View>
      </View>

      {/* Wrapped teaser — the ONE allowed gradient (see brief rule 4) */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open my 2026 Wrapped"
        onPress={() => router.push('/wrapped' as never)}
        style={{ marginTop: 20 }}
      >
        <LinearGradient
          colors={[CORAL, GOLD]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.wrappedCard}
        >
          <View>
            <Text style={styles.wrappedEyebrow}>MY 2026, SO FAR</Text>
            <Text style={styles.wrappedHeadline}>I really{'\n'}moved this year.</Text>
            <Text style={styles.wrappedFooter}>
              {ME.trips} trips · {ME.countries} countries · {ME.tipsGiven} tips
            </Text>
          </View>
          <Text style={styles.wrappedChevron}>›</Text>
        </LinearGradient>
      </Pressable>

      {/* My book — 2-col grid */}
      <View style={{ marginTop: 28 }}>
        <Eyebrow>My book</Eyebrow>
        <View style={styles.grid}>
          {ME.myTrips.map((t) => (
            <Pressable
              key={t.id}
              accessibilityRole="button"
              accessibilityLabel={t.destination}
              onPress={() => router.push(`/(tabs)/trip-notebook/${t.id}` as never)}
              style={styles.tripCard}
            >
              <Photo uri={t.coverUri} aspectRatio={4 / 5} radius={14}>
                <View style={styles.tripOverlay}>
                  <Text style={styles.tripDest}>{t.destination}</Text>
                  <Text style={styles.tripMeta}>
                    {t.monthLabel} · {t.placesCount} places
                  </Text>
                </View>
              </Photo>
            </Pressable>
          ))}
        </View>
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingTop: 8,
  },
  name: {
    fontFamily: 'InstrumentSerif_400Italic',
    fontSize: 28,
    color: INK,
    letterSpacing: -0.6,
  },
  handle: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 11,
    letterSpacing: 1.2,
    color: MUTE,
    marginTop: 2,
  },
  cog: { fontSize: 20, color: MUTE },
  statRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 20,
  },
  stat: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  statOutlined: {
    borderWidth: 1,
    borderColor: HAIR,
    backgroundColor: '#FFFFFF',
  },
  statTinted: { backgroundColor: TINT },
  statFilled: { backgroundColor: CORAL },
  statValue: {
    fontFamily: 'InstrumentSerif_400Italic',
    fontSize: 28,
    letterSpacing: -0.6,
  },
  statLabel: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 9,
    letterSpacing: 1.2,
    marginTop: 4,
  },
  wrappedCard: {
    borderRadius: 18,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  wrappedEyebrow: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 10,
    letterSpacing: 1.4,
    color: '#FFFFFF',
    opacity: 0.92,
  },
  wrappedHeadline: {
    fontFamily: 'InstrumentSerif_400Italic',
    fontSize: 28,
    lineHeight: 32,
    color: '#FFFFFF',
    letterSpacing: -0.6,
    marginTop: 8,
  },
  wrappedFooter: {
    fontFamily: 'Geist_500Medium',
    fontSize: 12,
    color: '#FFFFFF',
    opacity: 0.92,
    marginTop: 12,
  },
  wrappedChevron: {
    fontFamily: 'InstrumentSerif_400Italic',
    fontSize: 32,
    color: '#FFFFFF',
    marginLeft: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 14,
  },
  tripCard: {
    width: '48%',
  },
  tripOverlay: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
  },
  tripDest: {
    fontFamily: 'InstrumentSerif_400Italic',
    fontSize: 24,
    color: '#FFFFFF',
    letterSpacing: -0.4,
  },
  tripMeta: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 9,
    letterSpacing: 1.2,
    color: '#FFFFFF',
    opacity: 0.92,
    marginTop: 4,
  },
});
