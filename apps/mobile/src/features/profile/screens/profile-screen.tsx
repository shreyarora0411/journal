import { CityHero, Eyebrow, Face, Page, StatusSpace } from '@/components';
import { useAuthStore, useProfile, useSignOut } from '@/features/auth';
import { useFollowCounts } from '@/features/follows';
import { useDeleteList, useMyLists } from '@/features/lists';
import { useDeleteVouch, useMyVouches, useUpdateVouch, useVouchUses } from '@/features/trips';
import { useWishlistRows } from '@/features/wishlist';
import { useToast } from '@/hooks/use-toast';
import { log } from '@/lib/log';
import { deriveTrustProfile, knownForTail } from '@/lib/trust-context';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

const CORAL = '#FF4D2E';
const INK = '#1B1714';
const MUTE = '#8A8178';
const HAIR = '#E7E1D7';
const PAPER_CARD = '#FFFDFA';
const CHIP_BG = '#FBEFE9';

// Vouch identity type stack — Fraunces (display + voiced quotes) + Hanken
// Grotesk (UI). Chosen for the emotional-voice thesis: a friend's quote should
// read like a human voice, not a review.
const SERIF = 'Fraunces_500';
const SERIF_IT = 'Fraunces_400Italic';
const SANS = 'HankenGrotesk_400Regular';
const SANS_MED = 'HankenGrotesk_500Medium';
const SANS_SEMI = 'HankenGrotesk_600SemiBold';
const SANS_BOLD = 'HankenGrotesk_700Bold';

const VOUCH_TYPE_LABEL: Record<string, string> = {
  stay: 'Stay',
  eat_drink: 'Eat / Drink',
  do: 'Do',
  nightlife: 'Nightlife',
  good_to_know: 'Good to know',
  skip: 'Skip',
};

const cap = (s: string) => (s.length === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1));

/**
 * Profile · "You" — a followable travel-style IDENTITY, not a settings page.
 *
 * The identity engine (Granovetter weak-tie discovery + Cialdini social
 * currency): the header flaunts a derived travel-style signature + the domains
 * you're trusted for, backed by HONEST social-currency stats (vouches you
 * wrote, times your circle saved them, followers) — never stars, never
 * fabricated numbers. Then the payoff ("used by your circle"), the spine (your
 * vouches in your own voice), and private Saved + Lists.
 */
export function ProfileScreen() {
  const router = useRouter();
  const signOut = useSignOut();
  const profile = useProfile();
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  const vouchesQ = useMyVouches();
  const usesQ = useVouchUses();
  const listsQ = useMyLists();
  const wishlistQ = useWishlistRows();
  const followCounts = useFollowCounts(userId);
  const deleteList = useDeleteList();
  const updateVouch = useUpdateVouch();
  const deleteVouch = useDeleteVouch();
  const toast = useToast();

  // Travel-style identity, derived from the viewer's own vouches by domain.
  // Null at 0 vouches → the identity block is suppressed in favour of a prompt.
  const trust = useMemo(() => deriveTrustProfile(vouchesQ.data ?? []), [vouchesQ.data]);

  // Honest social-currency numbers — every one drawn from real rows.
  const vouchCount = (vouchesQ.data ?? []).length;
  const savedByCircle = (usesQ.data ?? []).length;
  const followers = followCounts.data?.followers ?? 0;

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
    Alert.alert('Delete this vouch?', 'It will be removed from your map and search.', [
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

  const confirmDeleteList = (name: string, onDelete: () => Promise<void>) => {
    Alert.alert('Delete this list?', `"${name}" will be removed. Items inside are not deleted.`, [
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
    ]);
  };

  useEffect(() => {
    log.event('profile.screen_entered');
  }, []);

  const displayName = profile.data?.display_name ?? '—';
  const handle = profile.data?.handle ? `@${profile.data.handle}` : '';
  const avatarUrl = profile.data?.avatar_url ?? null;

  const onSignOut = () => {
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

      {/* Identity header — face + name + sign-out */}
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

      {trust ? (
        <>
          {/* Travel-style signature — the identity you flaunt; the hook that
              makes someone follow you. Derived from your vouches by domain. */}
          <View style={styles.signature}>
            <Text style={styles.sigEyebrow}>TRAVEL STYLE</Text>
            <Text style={styles.sigLine}>{cap(knownForTail(trust))}.</Text>
          </View>

          {/* Trusted-for chips — domain opinion leadership made visible. */}
          <View style={styles.chips}>
            {trust.contexts.map((c) => (
              <View key={c} style={styles.chip}>
                <Text style={styles.chipText}>{c}</Text>
              </View>
            ))}
          </View>

          {/* Social-currency stats — honest numbers only. */}
          <View style={styles.stats}>
            <View style={styles.stat}>
              <Text style={styles.statNum}>{vouchCount}</Text>
              <Text style={styles.statLabel}>vouches</Text>
            </View>
            <View style={[styles.stat, styles.statMid]}>
              <Text style={styles.statNum}>{savedByCircle}</Text>
              <Text style={styles.statLabel}>saved by circle</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statNum}>{followers}</Text>
              <Text style={styles.statLabel}>follower{followers === 1 ? '' : 's'}</Text>
            </View>
          </View>
        </>
      ) : (
        <View style={styles.signature}>
          <Text style={styles.sigEyebrow}>TRAVEL STYLE</Text>
          <Text style={styles.sigPrompt}>
            Log a few vouches and your travel style takes shape here — the thing friends follow you
            for.
          </Text>
        </View>
      )}

      {/* USED BY YOUR CIRCLE — the altruistic payoff. Only when there are saves. */}
      {(usesQ.data ?? []).length > 0 ? (
        <View style={{ marginTop: 30 }}>
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

      {/* YOUR VOUCHES — the spine, in your own voice. */}
      <View style={{ marginTop: 32 }}>
        <Eyebrow>Your vouches</Eyebrow>
        {vouchesQ.isLoading ? (
          <Text style={styles.empty}>Loading…</Text>
        ) : (vouchesQ.data ?? []).length === 0 ? (
          <View style={styles.emptyInline}>
            <Text style={styles.emptyInlineBody}>
              Log a place and your vouch shows up here — in your own words.
            </Text>
          </View>
        ) : (
          <View style={{ gap: 10, marginTop: 12 }}>
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
                          hitSlop={12}
                          style={styles.vouchActionBtn}
                        >
                          <Text style={styles.vouchActionPrimary}>Save</Text>
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="Cancel edit"
                          onPress={cancelEditVouch}
                          hitSlop={12}
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
                          hitSlop={12}
                          style={styles.vouchActionBtn}
                        >
                          <Text style={styles.vouchActionLabel}>Edit</Text>
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="Delete vouch"
                          onPress={() => onDeleteVouch(v.id)}
                          hitSlop={12}
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

      {/* SAVED — private to you. */}
      <View style={{ marginTop: 32 }}>
        <Eyebrow>Saved (private)</Eyebrow>
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

      {/* LISTS — curated groupings the viewer made. */}
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
                onLongPress={() => confirmDeleteList(l.title, () => deleteList.mutateAsync(l.id))}
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
    fontFamily: SERIF,
    fontSize: 30,
    color: INK,
    letterSpacing: -0.6,
  },
  handle: {
    fontFamily: SANS_MED,
    fontSize: 13,
    color: MUTE,
    marginTop: 3,
  },
  cog: { fontSize: 20, color: MUTE },

  // Travel-style signature
  signature: { marginTop: 20 },
  sigEyebrow: {
    fontFamily: SANS_BOLD,
    fontSize: 10,
    letterSpacing: 1.6,
    color: '#C8A24A',
  },
  sigLine: {
    fontFamily: SERIF,
    fontSize: 22,
    lineHeight: 29,
    color: INK,
    letterSpacing: -0.3,
    marginTop: 6,
  },
  sigPrompt: {
    fontFamily: SANS,
    fontSize: 14,
    lineHeight: 21,
    color: MUTE,
    marginTop: 6,
  },

  // Trusted-for chips
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 14 },
  chip: { backgroundColor: CHIP_BG, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  chipText: { fontFamily: SANS_SEMI, fontSize: 12.5, color: '#9A3B1E' },

  // Social-currency stats
  stats: {
    flexDirection: 'row',
    marginTop: 18,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: HAIR,
  },
  stat: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  statMid: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: HAIR },
  statNum: { fontFamily: SERIF, fontSize: 24, color: INK },
  statLabel: { fontFamily: SANS, fontSize: 10.5, color: MUTE, marginTop: 2, letterSpacing: 0.2 },

  emptyInline: { paddingVertical: 14 },
  emptyInlineBody: { fontFamily: SANS, fontSize: 13, lineHeight: 20, color: MUTE },

  // Vouch cards — voice-forward.
  vouchCard: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: HAIR,
    backgroundColor: PAPER_CARD,
  },
  vouchMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  vouchType: {
    fontFamily: SANS_BOLD,
    fontSize: 9.5,
    letterSpacing: 1,
    color: CORAL,
    textTransform: 'uppercase',
  },
  vouchDot: { color: MUTE, fontSize: 12 },
  // The PLACE is the unit of a vouch — make it read clearly, not as faint
  // meta. Ink + bold + a touch larger so "Koh Samui" is legible at a glance.
  vouchDest: {
    fontFamily: SANS_BOLD,
    fontSize: 12,
    letterSpacing: 0.6,
    color: INK,
    textTransform: 'uppercase',
    flexShrink: 1,
  },
  vouchQuote: {
    fontFamily: SERIF_IT,
    fontSize: 17,
    lineHeight: 25,
    color: INK,
    marginTop: 8,
  },
  vouchEditInput: {
    fontFamily: SANS,
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
  vouchActionLabel: { fontFamily: SANS_SEMI, fontSize: 12, color: INK },
  vouchActionPrimary: { fontFamily: SANS_SEMI, fontSize: 12, color: CORAL },
  vouchActionDanger: { fontFamily: SANS_SEMI, fontSize: 12, color: '#B23A14' },

  // Used by your circle
  useCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: HAIR,
    backgroundColor: PAPER_CARD,
  },
  useLine: { flex: 1 },
  useWho: { fontFamily: SANS_BOLD, fontSize: 14, color: INK },
  useVerb: { fontFamily: SANS, fontSize: 14, color: MUTE },
  useQuote: { fontFamily: SERIF_IT, fontSize: 14, color: INK },

  listsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  newListLink: { fontFamily: SANS_SEMI, fontSize: 13, color: CORAL },
  listCard: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: HAIR,
    backgroundColor: PAPER_CARD,
  },
  listTitle: { fontFamily: SANS_SEMI, fontSize: 15, color: INK },
  listSub: { fontFamily: SANS, fontSize: 12, color: MUTE, marginTop: 4 },

  empty: { fontFamily: SANS, fontSize: 13, color: MUTE, marginTop: 16 },
  emptyCard: {
    marginTop: 14,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: HAIR,
    backgroundColor: PAPER_CARD,
  },
  emptyTitle: { fontFamily: SERIF, fontSize: 22, color: INK, letterSpacing: -0.4 },
  emptyBody: { fontFamily: SANS, fontSize: 13, lineHeight: 20, color: MUTE, marginTop: 8 },
});
