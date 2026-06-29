import { CategoryPill, CityHero, Eyebrow, Face, Page, StatusSpace, VenueThumb } from '@/components';
import { useAuthStore, useProfile, useSignOut } from '@/features/auth';
import { useDeleteList, useMyLists } from '@/features/lists';
import {
  useDeleteAtomicLog,
  useDeleteVouch,
  useMyAtomicLogs,
  useMyVouches,
  useUpdateVouch,
  useVouchUses,
} from '@/features/trips';
import { useWishlistRows } from '@/features/wishlist';
import { useToast } from '@/hooks/use-toast';
import { log } from '@/lib/log';
import type { Category } from '@/theme';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useMeStats } from '../api/use-me-stats';
import { useUserTrips } from '../api/use-user-trips';

const CORAL = '#FF4D2E';
const INK = '#1A1410';
const MUTE = '#7A716A';
const FAINT = '#B7AE9F';
const TINT = '#FAF6F0';
const HAIR = '#EFEAE2';

// Short type labels for the user's own vouches — match the composer/search/feed
// surfaces so a vouch reads the same everywhere. No stars, no score — just the
// kind of thing it is.
const VOUCH_TYPE_LABEL: Record<string, string> = {
  stay: 'Stay',
  eat_drink: 'Eat / Drink',
  do: 'Do',
  nightlife: 'Nightlife',
  good_to_know: 'Good to know',
  skip: 'Skip',
};

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
  const vouchesQ = useMyVouches();
  const usesQ = useVouchUses();
  const listsQ = useMyLists();
  const wishlistQ = useWishlistRows();
  const deleteTip = useDeleteAtomicLog();
  const deleteList = useDeleteList();
  const updateVouch = useUpdateVouch();
  const deleteVouch = useDeleteVouch();
  const toast = useToast();

  // Inline vouch edit — mirrors list-detail-vouches-screen.tsx. These are
  // always the viewer's own vouches (useMyVouches), so the affordances always
  // show; the hooks also enforce owner-only server-side.
  const [editingVouchId, setEditingVouchId] = useState<string | null>(null);
  const [vouchDraft, setVouchDraft] = useState('');

  const startEditVouch = (id: string, text: string) => {
    setEditingVouchId(id);
    setVouchDraft(text);
  };
  const cancelEditVouch = () => {
    setEditingVouchId(null);
    setVouchDraft('');
  };
  const onSaveVouchEdit = async (vouchId: string) => {
    try {
      await updateVouch.mutateAsync({ vouchId, text: vouchDraft });
      cancelEditVouch();
      toast.show({ message: 'Updated.', variant: 'success' });
    } catch (err) {
      log.error('update vouch failed', err);
      toast.show({ message: 'Could not update. Try again.', variant: 'error' });
    }
  };
  const onDeleteVouch = (vouchId: string) =>
    // The hooks invalidate ['vouches'], so on delete the card disappears.
    Alert.alert('Delete this vouch?', 'It will be removed from your book and search.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteVouch.mutateAsync({ vouchId });
            toast.show({ message: 'Deleted.', variant: 'success' });
          } catch (err) {
            log.error('delete vouch failed', err);
            toast.show({ message: 'Could not delete. Try again.', variant: 'error' });
          }
        },
      },
    ]);

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
      if (
        typeof window !== 'undefined' &&
        window.confirm('Sign out? You can sign back in with the same number.')
      ) {
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

      {/* Wrapped teaser removed — the /wrapped screen renders fabricated
          fixture stats (WRAPPED_2026), which violates the no-fake-data
          thesis. Re-add only when backed by real me_stats()-derived data. */}

      {/* =====================================================
          USED BY YOUR CIRCLE — the payoff loop. Someone you know
          saved a vouch YOU wrote, to act on later. PULL-only (no
          push): the author sees it on their own profile. The reward
          is the social signal itself (concern-for-others) — no count,
          no score, no points. Only renders when there are real saves.
          ===================================================== */}
      {(usesQ.data ?? []).length > 0 ? (
        <View style={{ marginTop: 28 }}>
          <Eyebrow>Used by your circle</Eyebrow>
          <View style={{ gap: 10, marginTop: 12 }}>
            {(usesQ.data ?? []).map((u) => {
              const who = u.saver_name ?? (u.saver_handle ? `@${u.saver_handle}` : 'Someone');
              const initials = who.replace(/^@/, '').slice(0, 2).toUpperCase();
              const short =
                u.vouch_text.length > 80 ? `${u.vouch_text.slice(0, 80)}…` : u.vouch_text;
              return (
                <View key={`${u.vouch_id}-${u.saver_id}`} style={styles.useCard}>
                  <Face uri={u.saver_avatar} initials={initials} size="sm" />
                  <Text style={styles.useLine}>
                    <Text style={styles.useWho}>{who}</Text>
                    <Text style={styles.useVerb}> saved your </Text>
                    <Text style={styles.useQuote}>"{short}"</Text>
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
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
                Add your first trip to start your recommendations.
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
                    {/* Count line per Round 2 spec: surfaces the trip's
                        actual content density on the profile card.
                        Tip count = venues with category (atomic logs);
                        we approximate by total venues for now since the
                        atomic-vs-trip-venue distinction needs a category
                        filter we can't do in the embedded count. */}
                    <Text style={styles.tripCounts}>
                      {t.venues_count} venue{t.venues_count === 1 ? '' : 's'} · {t.cities_count} cit
                      {t.cities_count === 1 ? 'y' : 'ies'} · {t.trip_photos_count} photo
                      {t.trip_photos_count === 1 ? '' : 's'}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* Your vouches — every vouch the user authored, list-bound or
            standalone. This is what makes fast-door logging not a void: a
            listless vouch still lands here, in the author's own voice. Voice-
            forward cards (italic Playfair quote), no stars/photos. */}
        <View style={{ marginTop: 22 }}>
          <Text style={styles.subEyebrow}>Your vouches</Text>
          {vouchesQ.isLoading ? (
            <Text style={styles.empty}>Loading…</Text>
          ) : (vouchesQ.data ?? []).length === 0 ? (
            <View style={styles.emptyInline}>
              <Text style={styles.emptyInlineBody}>
                Log a place and your vouch shows up here — in your own words.
              </Text>
            </View>
          ) : (
            <View style={{ gap: 10, marginTop: 8 }}>
              {(vouchesQ.data ?? []).map((v) => {
                const editing = editingVouchId === v.id;
                return (
                  <View key={v.id} style={styles.vouchCard}>
                    <View style={styles.vouchMetaRow}>
                      <Text style={styles.vouchType}>
                        {VOUCH_TYPE_LABEL[v.vouch_type] ?? v.vouch_type}
                      </Text>
                      {v.destination_text ? (
                        <>
                          <Text style={styles.vouchDot}>·</Text>
                          <Text style={styles.vouchDest} numberOfLines={1}>
                            {v.destination_text}
                          </Text>
                        </>
                      ) : null}
                    </View>
                    {editing ? (
                      <>
                        <TextInput
                          accessibilityLabel="Edit vouch"
                          value={vouchDraft}
                          onChangeText={(t) => setVouchDraft(t.slice(0, 500))}
                          multiline
                          autoFocus
                          style={styles.vouchEditInput}
                          selectionColor={CORAL}
                        />
                        <View style={styles.vouchActions}>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel="Save edit"
                            onPress={() => onSaveVouchEdit(v.id)}
                            disabled={updateVouch.isPending}
                            hitSlop={6}
                            style={styles.vouchActionBtn}
                          >
                            <Text style={styles.vouchActionPrimary}>Save</Text>
                          </Pressable>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel="Cancel edit"
                            onPress={cancelEditVouch}
                            hitSlop={6}
                            style={styles.vouchActionBtn}
                          >
                            <Text style={styles.vouchActionLabel}>Cancel</Text>
                          </Pressable>
                        </View>
                      </>
                    ) : (
                      <>
                        <Text style={styles.vouchQuote}>"{v.text}"</Text>
                        <View style={styles.vouchActions}>
                          <View style={{ flex: 1 }} />
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel="Edit vouch"
                            onPress={() => startEditVouch(v.id, v.text)}
                            hitSlop={6}
                            style={styles.vouchActionBtn}
                          >
                            <Text style={styles.vouchActionLabel}>Edit</Text>
                          </Pressable>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel="Delete vouch"
                            onPress={() => onDeleteVouch(v.id)}
                            hitSlop={6}
                            style={styles.vouchActionBtn}
                          >
                            <Text style={styles.vouchActionDanger}>Delete</Text>
                          </Pressable>
                        </View>
                      </>
                    )}
                  </View>
                );
              })}
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
                Add your first tip to start your recommendations.
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
        <View style={styles.listsHeader}>
          <Eyebrow>Lists I made</Eyebrow>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="New list"
            onPress={() => router.push('/(tabs)/list/new' as never)}
            hitSlop={8}
          >
            <Text style={styles.newListLink}>+ New list</Text>
          </Pressable>
        </View>
        {listsQ.isLoading ? (
          <Text style={styles.empty}>Loading…</Text>
        ) : (listsQ.data ?? []).length === 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Make your first list"
            onPress={() => router.push('/(tabs)/list/new' as never)}
            style={styles.emptyCard}
          >
            <Text style={styles.emptyTitle}>No lists yet.</Text>
            <Text style={styles.emptyBody}>
              Group your favorite places — make a Tokyo list, a Goa list, a Mira list. Tap to start
              one.
            </Text>
          </Pressable>
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
  // Your-vouches card — voice-forward, no stars/photos. The voiced line is the
  // hero (italic Playfair pull-quote); type + destination are the quiet meta.
  vouchCard: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: HAIR,
    backgroundColor: '#FFFFFF',
  },
  vouchMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  vouchType: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 9,
    letterSpacing: 1.2,
    color: CORAL,
    textTransform: 'uppercase',
  },
  vouchDot: { color: FAINT, fontSize: 11 },
  vouchDest: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 9,
    letterSpacing: 1.2,
    color: MUTE,
    textTransform: 'uppercase',
    flexShrink: 1,
  },
  vouchQuote: {
    fontFamily: 'PlayfairDisplay_500Medium_Italic',
    fontSize: 16,
    lineHeight: 24,
    color: INK,
    marginTop: 8,
  },
  // Inline edit + owner actions on a profile vouch card — mirrors
  // list-detail-vouches-screen.tsx so a vouch reads/edits the same everywhere.
  vouchEditInput: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 16,
    lineHeight: 24,
    color: INK,
    minHeight: 60,
    textAlignVertical: 'top',
    marginTop: 8,
  },
  vouchActions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  vouchActionBtn: {
    borderWidth: 1,
    borderColor: HAIR,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  vouchActionLabel: { fontFamily: 'DMSans_600SemiBold', fontSize: 12, color: INK },
  vouchActionPrimary: { fontFamily: 'DMSans_600SemiBold', fontSize: 12, color: CORAL },
  vouchActionDanger: { fontFamily: 'DMSans_600SemiBold', fontSize: 12, color: '#B23A14' },
  // "Used by your circle" — the payoff line. Voice-forward, no count/score.
  useCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: HAIR,
    backgroundColor: '#FFFFFF',
  },
  useLine: { flex: 1 },
  useWho: { fontFamily: 'DMSans_700Bold', fontSize: 14, color: INK },
  useVerb: { fontFamily: 'DMSans_400Regular', fontSize: 14, color: MUTE },
  useQuote: {
    fontFamily: 'PlayfairDisplay_500Medium_Italic',
    fontSize: 14,
    color: INK,
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
  listsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  newListLink: { fontFamily: 'DMSans_600SemiBold', fontSize: 13, color: CORAL },
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
  tripCounts: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 11.5,
    color: MUTE,
    marginTop: 6,
  },
});
