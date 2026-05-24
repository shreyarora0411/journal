import { Photo, StatusSpace } from '@/components';
import { WRAPPED_2026 } from '@/features/feed/lib/fixtures';
import { log } from '@/lib/log';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

const CORAL = '#FF4D2E';
const GOLD = '#FFB300';
const INK = '#1A1410';
const MUTE = '#7A716A';

/**
 * Wrapped — Pride · my year, my taste (#15 of the redesign — Batch C).
 *
 * Vertical poster layout. Top half is the ONE allowed gradient in the
 * app (coral → gold, per brief rule 4). Mono eyebrow + italic-serif
 * giant headline + stacked stats live on top of the gradient; below it
 * sits a 2-col mini grid of the most-stolen tips with coral "used N
 * times" chips, then an ink "Share my card" CTA.
 */
export function WrappedScreen() {
  const router = useRouter();
  const w = WRAPPED_2026;

  useEffect(() => {
    log.event('wrapped.screen_entered');
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <LinearGradient
          colors={[CORAL, GOLD]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradientPanel}
        >
          <StatusSpace />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={() => router.back()}
            style={styles.closePill}
          >
            <Text style={styles.closeGlyph}>×</Text>
          </Pressable>

          <View style={{ marginTop: 24 }}>
            <Text style={styles.eyebrow}>{w.yearLabel}</Text>
            <Text style={styles.headline}>I really{'\n'}moved this year.</Text>

            <View style={styles.statsBlock}>
              <StatLine value={w.cities} label="cities" />
              <StatLine value={w.placesLogged} label="places logged" />
              <StatLine value={w.tipsGiven} label="tips" />
              <StatLine value={w.tipsUsedByFriends} label="used by friends" />
            </View>
          </View>
        </LinearGradient>

        {/* Most-stolen tips */}
        <View style={styles.tipsBlock}>
          <Text style={styles.tipsEyebrow}>MOST STOLEN TIPS</Text>
          <View style={styles.tipsGrid}>
            {w.mostStolenTips.map((t) => (
              <View key={t.id} style={styles.tipCard}>
                <Photo uri={t.coverUri} aspectRatio={1} radius={12}>
                  <View style={styles.usedChip}>
                    <Text style={styles.usedChipLabel}>used {t.usedCount}×</Text>
                  </View>
                </Photo>
                <Text style={styles.tipPlace} numberOfLines={1}>
                  {t.place}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Share my card"
          onPress={() => undefined}
          style={styles.cta}
        >
          <Text style={styles.ctaLabel}>Share my card</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function StatLine({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.statLine}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  gradientPanel: {
    paddingHorizontal: 22,
    paddingBottom: 40,
  },
  closePill: {
    alignSelf: 'flex-end',
    marginTop: 8,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeGlyph: {
    color: '#FFFFFF',
    fontSize: 22,
    fontFamily: 'Geist_500Medium',
  },
  eyebrow: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 11,
    letterSpacing: 1.4,
    color: '#FFFFFF',
  },
  headline: {
    fontFamily: 'InstrumentSerif_400Italic',
    fontSize: 52,
    lineHeight: 56,
    color: '#FFFFFF',
    letterSpacing: -1.6,
    marginTop: 16,
  },
  statsBlock: {
    marginTop: 32,
    gap: 16,
  },
  statLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 12,
  },
  statValue: {
    fontFamily: 'InstrumentSerif_400Italic',
    fontSize: 56,
    lineHeight: 56,
    color: '#FFFFFF',
    letterSpacing: -1.6,
    minWidth: 88,
  },
  statLabel: {
    fontFamily: 'Geist_500Medium',
    fontSize: 16,
    color: '#FFFFFF',
    opacity: 0.95,
  },
  tipsBlock: {
    paddingHorizontal: 22,
    paddingTop: 28,
  },
  tipsEyebrow: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 10,
    letterSpacing: 1.4,
    color: MUTE,
  },
  tipsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
  },
  tipCard: { width: '48%' },
  usedChip: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: CORAL,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  usedChipLabel: {
    fontFamily: 'Geist_500Medium',
    fontSize: 11,
    color: '#FFFFFF',
  },
  tipPlace: {
    fontFamily: 'InstrumentSerif_400Italic',
    fontSize: 18,
    color: INK,
    letterSpacing: -0.4,
    marginTop: 8,
  },
  cta: {
    marginHorizontal: 22,
    marginTop: 24,
    backgroundColor: INK,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
  },
  ctaLabel: {
    fontFamily: 'Geist_500Medium',
    fontSize: 16,
    color: '#FFFFFF',
  },
});
