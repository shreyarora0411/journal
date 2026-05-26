import { Eyebrow, Face, Page, StatusSpace } from '@/components';
import { useAuthStore, useProfile, useSignOut } from '@/features/auth';
import { log } from '@/lib/log';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useMeStats } from '../api/use-me-stats';
import { useUserTrips } from '../api/use-user-trips';

const CORAL = '#FF4D2E';
const GOLD = '#FFB300';
const INK = '#1A1410';
const MUTE = '#7A716A';
const TINT = '#FAF6F0';
const HAIR = '#EFEAE2';

/**
 * Profile · Travel book.
 *
 * Real data only:
 *   - Name + handle + avatar from useProfile()
 *   - Trips/countries/tips stats from me_stats()
 *   - Trip grid from useUserTrips(self)
 *
 * Wrapped teaser only renders when the user has at least one trip;
 * a brand-new pilot user sees a clean profile with `0` stats and a
 * quiet empty state below — no theatrical "0 trips · 0 countries"
 * gradient banner.
 */
export function ProfileScreen() {
  const router = useRouter();
  const signOut = useSignOut();
  const stats = useMeStats();
  const profile = useProfile();
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  const tripsQ = useUserTrips(userId);

  useEffect(() => {
    log.event('profile.screen_entered');
  }, []);

  const fmt = (n: number | undefined | null): string => (typeof n === 'number' ? String(n) : '—');
  const trips = stats.data?.trips_count ?? null;
  const countries = stats.data?.countries_count ?? null;
  const tips = stats.data?.tips_given_count ?? null;
  const tripsLabel = fmt(trips);
  const countriesLabel = fmt(countries);
  const tipsLabel = fmt(tips);
  const hasAnyContent = (trips ?? 0) > 0 || (countries ?? 0) > 0 || (tips ?? 0) > 0;

  const displayName = profile.data?.display_name ?? '—';
  const handle = profile.data?.handle ? `@${profile.data.handle}` : '';
  const avatarUrl = profile.data?.avatar_url ?? null;
  const myTrips = tripsQ.data ?? [];

  const onSignOut = () => {
    Alert.alert('Sign out?', 'You can sign back in with the same number.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut.mutateAsync();
            log.event('profile.signed_out');
          } catch (err) {
            log.error('sign out failed', err);
          }
        },
      },
    ]);
  };

  return (
    <Page>
      <StatusSpace />

      {/* Header — face + name + cog */}
      <View style={styles.header}>
        <Face uri={avatarUrl} initials={displayName.slice(0, 2).toUpperCase()} size="lg" />
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{displayName}</Text>
          {handle ? <Text style={styles.handle}>{handle}</Text> : null}
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Sign out" onPress={onSignOut}>
          <Text style={styles.cog}>⎋</Text>
        </Pressable>
      </View>

      {/* 3-stat row — real numbers via me_stats(); `—` while loading,
          0 when zero (honest). */}
      <View style={styles.statRow}>
        <View style={[styles.stat, styles.statOutlined]}>
          <Text style={[styles.statValue, { color: INK }]}>{tripsLabel}</Text>
          <Text style={[styles.statLabel, { color: MUTE }]}>Trips</Text>
        </View>
        <View style={[styles.stat, styles.statTinted]}>
          <Text style={[styles.statValue, { color: INK }]}>{countriesLabel}</Text>
          <Text style={[styles.statLabel, { color: MUTE }]}>Countries</Text>
        </View>
        <View style={[styles.stat, styles.statFilled]}>
          <Text style={[styles.statValue, { color: '#FFFFFF' }]}>{tipsLabel}</Text>
          <Text style={[styles.statLabel, { color: '#FFFFFF', opacity: 0.85 }]}>Tips I gave</Text>
        </View>
      </View>

      {/* Wrapped teaser only when there's something to wrap. */}
      {hasAnyContent ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open my Wrapped"
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
              <Text style={styles.wrappedEyebrow}>MY YEAR, SO FAR</Text>
              <Text style={styles.wrappedHeadline}>I really{'\n'}moved this year.</Text>
              <Text style={styles.wrappedFooter}>
                {tripsLabel} trips · {countriesLabel} countries · {tipsLabel} tips
              </Text>
            </View>
            <Text style={styles.wrappedChevron}>›</Text>
          </LinearGradient>
        </Pressable>
      ) : null}

      {/* My book — real trips. */}
      <View style={{ marginTop: 28 }}>
        <Eyebrow>My book</Eyebrow>
        {tripsQ.isLoading ? (
          <Text style={styles.empty}>Loading…</Text>
        ) : myTrips.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Nothing in the book yet.</Text>
            <Text style={styles.emptyBody}>
              Tap the Add tab. One honest line is enough to start.
            </Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {myTrips.map((t) => (
              <Pressable
                key={t.id}
                accessibilityRole="button"
                accessibilityLabel={t.title}
                onPress={() => router.push(`/trip/${t.id}` as never)}
                style={styles.tripCard}
              >
                <View style={styles.tripCardInner}>
                  <Text style={styles.tripDest}>{t.title}</Text>
                  {t.start_date ? (
                    <Text style={styles.tripMeta}>
                      {new Date(t.start_date).toDateString().toUpperCase()}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            ))}
          </View>
        )}
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
  empty: { fontFamily: 'Geist_400Regular', fontSize: 13, color: MUTE, marginTop: 16 },
  emptyCard: {
    marginTop: 14,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: HAIR,
    backgroundColor: '#FFFFFF',
  },
  emptyTitle: {
    fontFamily: 'InstrumentSerif_400Italic',
    fontSize: 22,
    color: INK,
    letterSpacing: -0.4,
  },
  emptyBody: {
    fontFamily: 'Geist_400Regular',
    fontSize: 13,
    lineHeight: 20,
    color: MUTE,
    marginTop: 8,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 14,
  },
  tripCard: { width: '48%' },
  tripCardInner: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: HAIR,
    backgroundColor: '#FFFFFF',
    minHeight: 100,
    justifyContent: 'flex-end',
  },
  tripDest: {
    fontFamily: 'InstrumentSerif_400Italic',
    fontSize: 22,
    color: INK,
    letterSpacing: -0.4,
  },
  tripMeta: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 9,
    letterSpacing: 1.2,
    color: MUTE,
    marginTop: 4,
  },
});
