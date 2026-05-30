import { CategoryPill, CityHero, Eyebrow, Face, Page, StatusSpace, VenueThumb } from '@/components';
import { useAuthStore, useProfile, useSignOut } from '@/features/auth';
import { useDeleteList, useMyLists } from '@/features/lists';
import { useDeleteAtomicLog, useMyAtomicLogs } from '@/features/trips';
import { useWishlistRows } from '@/features/wishlist';
import { useToast } from '@/hooks/use-toast';
import { log } from '@/lib/log';
import type { Category } from '@/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
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
  const tipsQ = useMyAtomicLogs(12);
  const listsQ = useMyLists();
  const wishlistQ = useWishlistRows();
  const deleteTip = useDeleteAtomicLog();
  const deleteList = useDeleteList();
  const toast = useToast();

  /** Long-press confirmation pattern. Used for both tips and lists. */
  const confirmDelete = (kind: 'tip' | 'list', name: string, onDelete: () => Promise<void>) => {
    Alert.alert(
      kind === 'tip' ? 'Delete this tip?' : 'Delete this list?',
      kind === 'tip'
        ? `"${name}" will be removed from your book.`
        : `"${name}" will be removed. Items inside are not deleted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await onDelete();
              toast.show({ message: `Deleted ${name}.`, variant: 'success' });
            } catch (err) {
              const msg = err instanceof Error ? err.message : 'Could not delete.';
              toast.show({ message: msg, variant: 'error' });
            }
          },
        },
      ],
    );
  };

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
    // Alert.alert is a no-op on React Native Web — fall back to
    // window.confirm so the sign-out flow works during web preview.
    const run = async () => {
      try {
        await signOut.mutateAsync();
        log.event('profile.signed_out');
      } catch (err) {
        log.error('sign out failed', err);
      }
    };
    if (Platform.OS === 'web') {
      // eslint-disable-next-line no-alert
      if (typeof window !== 'undefined' && window.confirm('Sign out? You can sign back in with the same number.')) {
        void run();
      }
      return;
    }
    Alert.alert('Sign out?', 'You can sign back in with the same number.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: run },
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

      {/* =====================================================
          AUTHORED — things I wrote (trips + tips).
          ===================================================== */}
      <View style={{ marginTop: 32 }}>
        <Eyebrow>I wrote</Eyebrow>

        {/* Trips */}
        <View style={{ marginTop: 14 }}>
          <Text style={styles.subEyebrow}>Trips</Text>
          {tripsQ.isLoading ? (
            <Text style={styles.empty}>Loading…</Text>
          ) : myTrips.length === 0 ? (
            <View style={styles.emptyInline}>
              <Text style={styles.emptyInlineBody}>
                No trips yet. The Trip mode on Add lets you frame one.
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

        {/* Tips */}
        <View style={{ marginTop: 22 }}>
          <Text style={styles.subEyebrow}>Tips</Text>
          {tipsQ.isLoading ? (
            <Text style={styles.empty}>Loading…</Text>
          ) : (tipsQ.data ?? []).length === 0 ? (
            <View style={styles.emptyInline}>
              <Text style={styles.emptyInlineBody}>
                No tips yet. Atomic recommendations from Add land here.
              </Text>
            </View>
          ) : (
            <View style={{ gap: 18, marginTop: 8 }}>
              {(() => {
                // Group tips by city. Cityless tips go in a "Standalone"
                // bucket at the end so they're still visible.
                const tips = tipsQ.data ?? [];
                const groups = new Map<
                  string,
                  {
                    cityName: string;
                    countryName: string | null;
                    items: typeof tips;
                  }
                >();
                for (const t of tips) {
                  const key = t.city?.id ?? '__standalone__';
                  const existing = groups.get(key);
                  if (existing) {
                    existing.items.push(t);
                  } else {
                    groups.set(key, {
                      cityName: t.city?.name ?? 'Standalone',
                      countryName: t.city?.country?.display_name ?? null,
                      items: [t],
                    });
                  }
                }
                return Array.from(groups.entries()).map(([key, group]) => (
                  <View key={key} style={{ gap: 10 }}>
                    <CityHero
                      cityName={group.cityName}
                      countryName={group.countryName}
                      meta={`${group.items.length} TIP${group.items.length === 1 ? '' : 'S'}`}
                      height={140}
                    />
                    {group.items.map((t) => (
                      <Pressable
                        key={t.id}
                        accessibilityRole="button"
                        accessibilityLabel={t.name}
                        onPress={() => router.push('/(tabs)/book' as never)}
                        onLongPress={() =>
                          confirmDelete('tip', t.name, () => deleteTip.mutateAsync(t.id))
                        }
                        delayLongPress={400}
                        style={styles.tipCard}
                      >
                        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
                          {t.cover_photo_path || t.google_place_id ? (
                            <VenueThumb
                              storagePath={t.cover_photo_path}
                              googlePlaceId={t.google_place_id}
                              size={72}
                            />
                          ) : null}
                          <View style={{ flex: 1, gap: 8 }}>
                            <View style={styles.tipHeader}>
                              <Text style={styles.tipName}>{t.name}</Text>
                              {t.category ? (
                                <CategoryPill category={t.category as Category} variant="soft" />
                              ) : null}
                            </View>
                            {t.one_line ? (
                              <Text style={styles.tipQuote} numberOfLines={2}>
                                "{t.one_line}"
                              </Text>
                            ) : null}
                          </View>
                        </View>
                      </Pressable>
                    ))}
                  </View>
                ));
              })()}
            </View>
          )}
        </View>
      </View>

      {/* =====================================================
          SAVED — places I want to act on (wishlist).
          ===================================================== */}
      <View style={{ marginTop: 32 }}>
        <Eyebrow>I saved</Eyebrow>
        {wishlistQ.isLoading ? (
          <Text style={styles.empty}>Loading…</Text>
        ) : (
          (() => {
            const rows = wishlistQ.data ?? [];
            const parents = rows.filter((w) => w.parent_wishlist_item_id === null);
            if (parents.length === 0) {
              return (
                <View style={styles.emptyInline}>
                  <Text style={styles.emptyInlineBody}>
                    Nothing saved yet. Tap "+ Plan" on a destination or "Stash" on a venue.
                  </Text>
                </View>
              );
            }
            return (
              <View style={{ gap: 12, marginTop: 12 }}>
                {parents.map((p) => {
                  const stashed = rows.filter((c) => c.parent_wishlist_item_id === p.id);
                  return (
                    <Pressable
                      key={p.id}
                      accessibilityRole="button"
                      accessibilityLabel={p.target_label ?? 'Saved destination'}
                      onPress={() =>
                        p.target_external_id
                          ? router.push(`/(tabs)/destination/${p.target_external_id}` as never)
                          : undefined
                      }
                    >
                      <CityHero
                        cityName={p.target_label ?? 'Saved'}
                        countryName={null}
                        meta={
                          stashed.length > 0
                            ? `${stashed.length} STASH${stashed.length === 1 ? '' : 'ES'}`
                            : 'PLANNED'
                        }
                        height={120}
                      />
                    </Pressable>
                  );
                })}
              </View>
            );
          })()
        )}
      </View>

      {/* =====================================================
          LISTS — curated groupings, neither pure authored nor saved.
          ===================================================== */}
      <View style={{ marginTop: 32, marginBottom: 80 }}>
        <Eyebrow>Lists I made</Eyebrow>
        {listsQ.isLoading ? (
          <Text style={styles.empty}>Loading…</Text>
        ) : (listsQ.data ?? []).length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No lists yet.</Text>
            <Text style={styles.emptyBody}>
              Group your favorite places — make a Tokyo list, a Goa list, a Mira list.
            </Text>
          </View>
        ) : (
          <View style={{ gap: 8, marginTop: 12 }}>
            {(listsQ.data ?? []).map((l) => (
              <Pressable
                key={l.id}
                accessibilityRole="button"
                accessibilityLabel={l.title}
                onPress={() => router.push(`/(tabs)/list/${l.id}` as never)}
                onLongPress={() =>
                  confirmDelete('list', l.title, () => deleteList.mutateAsync(l.id))
                }
                delayLongPress={400}
                style={styles.listCard}
              >
                <Text style={styles.listTitle}>{l.title}</Text>
                {l.description ? (
                  <Text style={styles.listSub} numberOfLines={1}>
                    {l.description}
                  </Text>
                ) : null}
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
    fontFamily: 'PlayfairDisplay_500Medium',
    fontSize: 28,
    color: INK,
    letterSpacing: -0.6,
  },
  handle: {
    fontFamily: 'DMSans_700Bold',
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
    fontFamily: 'PlayfairDisplay_500Medium',
    fontSize: 28,
    letterSpacing: -0.6,
  },
  statLabel: {
    fontFamily: 'DMSans_700Bold',
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
    fontFamily: 'DMSans_700Bold',
    fontSize: 10,
    letterSpacing: 1.4,
    color: '#FFFFFF',
    opacity: 0.92,
  },
  wrappedHeadline: {
    fontFamily: 'PlayfairDisplay_500Medium',
    fontSize: 28,
    lineHeight: 32,
    color: '#FFFFFF',
    letterSpacing: -0.6,
    marginTop: 8,
  },
  wrappedFooter: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 12,
    color: '#FFFFFF',
    opacity: 0.92,
    marginTop: 12,
  },
  wrappedChevron: {
    fontFamily: 'PlayfairDisplay_500Medium',
    fontSize: 32,
    color: '#FFFFFF',
    marginLeft: 12,
  },
  subEyebrow: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 10,
    letterSpacing: 1.2,
    color: MUTE,
    marginBottom: 6,
  },
  emptyInline: {
    paddingVertical: 14,
  },
  emptyInlineBody: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    lineHeight: 20,
    color: MUTE,
  },
  tipCard: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: HAIR,
    backgroundColor: '#FFFFFF',
  },
  tipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  tipName: {
    fontFamily: 'PlayfairDisplay_500Medium',
    fontSize: 20,
    color: INK,
    letterSpacing: -0.4,
    flex: 1,
  },
  tipMeta: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 9,
    letterSpacing: 1.2,
    color: MUTE,
    marginTop: 4,
  },
  tipQuote: {
    fontFamily: 'PlayfairDisplay_500Medium',
    fontSize: 15,
    lineHeight: 22,
    color: INK,
    marginTop: 8,
  },
  listCard: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: HAIR,
    backgroundColor: '#FFFFFF',
  },
  listTitle: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 15,
    color: INK,
  },
  listSub: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    color: MUTE,
    marginTop: 4,
  },
  empty: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: MUTE, marginTop: 16 },
  emptyCard: {
    marginTop: 14,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: HAIR,
    backgroundColor: '#FFFFFF',
  },
  emptyTitle: {
    fontFamily: 'PlayfairDisplay_500Medium',
    fontSize: 22,
    color: INK,
    letterSpacing: -0.4,
  },
  emptyBody: {
    fontFamily: 'DMSans_400Regular',
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
    fontFamily: 'PlayfairDisplay_500Medium',
    fontSize: 22,
    color: INK,
    letterSpacing: -0.4,
  },
  tripMeta: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 9,
    letterSpacing: 1.2,
    color: MUTE,
    marginTop: 4,
  },
});
