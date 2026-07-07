import { Eyebrow, Face, Icon, Page, StatusSpace, VoicedNote } from '@/components';
import {
  useAuthStore,
  useProfile,
  useSignOut,
  useUpdateProfile,
  useUploadAvatar,
} from '@/features/auth';
import { useReachCounts } from '@/features/follows';
import { buildPersonalInviteText, buildWhatsAppLink } from '@/features/invite';
import { useDeleteList, useMyLists } from '@/features/lists';
import { useToast } from '@/hooks/use-toast';
import { log } from '@/lib/log';
import { recordPlaceSignal } from '@/lib/signals';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { type Visibility, ZERO_AXES } from '@journal/shared';
import { useQuery } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Alert,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useMyPlaces, useMyTaste } from '../api/use-taste-data';
import { LoadError } from '../components/LoadError';
import { TasteShareCard } from '../components/taste-share-card';
import {
  CARD,
  CORAL,
  GOLD,
  HAIR,
  INK,
  MUTE,
  SANS,
  SANS_BOLD,
  SANS_SEMI,
  SERIF,
  TASTE_TYPE_SCALE,
  TINT,
} from '../lib/taste-tokens';

const VISIBILITY_OPTIONS: ReadonlyArray<{ key: Visibility; label: string }> = [
  { key: 'followers', label: 'Followers' },
  { key: 'friends_of_friends', label: 'Friends of friends' },
  { key: 'everyone', label: 'Everyone' },
];

/**
 * You — public taste identity + account home (spec §3b). Your Map (book tab)
 * is the working artifact for logging; this is "the map people borrow," plus
 * controls. Identity is always DERIVED (taste readout, loved-places count) —
 * never self-declared — and the identity card opens the viewer's own
 * person/[id] page so they see exactly what a borrower sees.
 */
export function YouScreen() {
  const router = useRouter();
  const viewerId = useAuthStore((s) => s.session?.user.id ?? null);
  const profile = useProfile();
  const updateProfile = useUpdateProfile();
  const uploadAvatar = useUploadAvatar();
  const signOut = useSignOut();
  const tasteQ = useMyTaste();
  const placesQ = useMyPlaces();
  const listsQ = useMyLists();
  const deleteList = useDeleteList();
  const reachQ = useReachCounts(viewerId);
  const toast = useToast();

  const [editing, setEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [bioDraft, setBioDraft] = useState('');
  const [shareVisible, setShareVisible] = useState(false);

  const displayName = profile.data?.display_name ?? '—';
  const handle = profile.data?.handle ? `@${profile.data.handle}` : '';
  const bio = profile.data?.bio ?? null;

  const startEdit = () => {
    setNameDraft(profile.data?.display_name ?? '');
    setBioDraft(profile.data?.bio ?? '');
    setEditing(true);
  };
  const cancelEdit = () => setEditing(false);

  const onSaveEdit = async () => {
    const trimmedName = nameDraft.trim();
    if (trimmedName.length === 0) {
      toast.show({ message: 'Give yourself a name.', variant: 'error' });
      return;
    }
    try {
      await updateProfile.mutateAsync({
        display_name: trimmedName,
        bio: bioDraft.trim().length > 0 ? bioDraft.trim() : null,
      });
      setEditing(false);
      toast.show({ message: 'Updated.', variant: 'success' });
    } catch (err) {
      log.error('update profile failed', err);
      toast.show({ message: 'Could not update. Try again.', variant: 'error' });
    }
  };

  const onChangePhoto = async () => {
    if (Platform.OS !== 'web') {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        toast.show({ message: 'No photo permission.', variant: 'error' });
        return;
      }
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
      exif: false,
    });
    if (result.canceled || !result.assets?.[0]) return;
    try {
      await uploadAvatar.mutateAsync(result.assets[0].uri);
      toast.show({ message: 'Photo updated.', variant: 'success' });
    } catch (err) {
      log.error('avatar upload failed', err);
      toast.show({ message: 'Could not upload photo. Try again.', variant: 'error' });
    }
  };

  // Taste identity — derived, never self-declared.
  const lovedPlaces = useMemo(
    () => (placesQ.data ?? []).filter((p) => p.sentiment === 'loved'),
    [placesQ.data],
  );
  const hubCount = useMemo(
    () => new Set(lovedPlaces.map((p) => p.place?.hub).filter(Boolean)).size,
    [lovedPlaces],
  );
  const readout = tasteQ.data?.readout ?? [];

  // Your voice — the notes are the moat; this surface farms them.
  const voicedPlaces = useMemo(
    () => (placesQ.data ?? []).filter((p) => p.note !== null),
    [placesQ.data],
  );
  // `places` arrives newest-reaction-first, so the first voiced row is the
  // closest honest approximation of "latest note" available from this hook.
  const latestVoiced = voicedPlaces[0] ?? null;
  const lovedWithoutNote = lovedPlaces.filter((p) => p.note === null).length;

  // Which places already carry the viewer's "what to order" picks —
  // useMyPlaces doesn't return dishes and widening it isn't this screen's
  // call, so one cheap own-row select (RLS-scoped) feeds the diff below.
  const dishPlacesQ = useQuery({
    queryKey: ['taste', 'my-dish-places', viewerId],
    // The config guard keeps getSupabase from throwing in env-less contexts
    // (jest included) — this screen's other data arrives via mocked hooks.
    enabled: Boolean(viewerId) && isSupabaseConfigured(),
    staleTime: 60_000,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await getSupabase()
        .from('place_dishes')
        .select('place_id')
        .eq('user_id', viewerId as string);
      if (error) throw error;
      return (data ?? []).map((r) => r.place_id as string);
    },
  });
  // Undefined data (loading or failed) computes to 0 — a nudge built on bad
  // data would guilt-trip toward a broken flow, so it just stays hidden.
  const lovedMissingOrder = useMemo(() => {
    if (!dishPlacesQ.data) return 0;
    const withDishes = new Set(dishPlacesQ.data);
    return lovedPlaces.filter((p) => p.place && !withDishes.has(p.place.id)).length;
  }, [lovedPlaces, dishPlacesQ.data]);

  // Feed the share card named loves — flatMap over a type guard keeps TS
  // happy without a verbose predicate function for the nullable `place`.
  const shareCardPlaces = useMemo(
    () => lovedPlaces.flatMap((p) => (p.place ? [{ name: p.place.name, note: p.note }] : [])),
    [lovedPlaces],
  );

  const confirmDeleteList = (name: string, onDelete: () => Promise<void>) => {
    Alert.alert(`Delete "${name}"?`, 'The places on it stay on your map — only the shelf goes.', [
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

  const onInvite = () => {
    log.event('you.invite_tapped');
    Linking.openURL(buildWhatsAppLink(buildPersonalInviteText(viewerId))).catch(() => undefined);
  };

  const onShareTaste = () => {
    log.event('you.share_taste_tapped');
    recordPlaceSignal('taste_card_shared');
    setShareVisible(true);
  };

  const onSetVisibility = (v: Visibility) => {
    if (v === profile.data?.default_visibility) return;
    updateProfile.mutate({ default_visibility: v });
  };

  const onSignOut = () => {
    const run = async () => {
      try {
        await signOut.mutateAsync();
        log.event('you.signed_out');
      } catch (err) {
        log.error('sign out failed', err);
      }
    };
    if (Platform.OS === 'web') {
      // eslint-disable-next-line no-alert
      if (
        typeof window !== 'undefined' &&
        window.confirm(
          "Sign out? Getting back in isn't self-serve yet — you'd need a hand from us.",
        )
      ) {
        void run();
      }
      return;
    }
    Alert.alert(
      'Sign out?',
      "Getting back in isn't self-serve yet — you'd need a hand from us. Sure?",
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign out', style: 'destructive', onPress: run },
      ],
    );
  };

  const following = reachQ.data?.following ?? 0;
  const borrowers = reachQ.data?.borrowers ?? 0;

  return (
    <Page>
      <StatusSpace />

      {/* 1. Header — Face + name + handle. Tappable to edit avatar/name/bio. */}
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Change photo"
          onPress={onChangePhoto}
          disabled={uploadAvatar.isPending}
        >
          <Face
            uri={profile.data?.avatar_url}
            initials={displayName.slice(0, 2).toUpperCase()}
            size="lg"
          />
        </Pressable>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.name} numberOfLines={1}>
            {displayName}
          </Text>
          {handle ? <Text style={styles.handle}>{handle}</Text> : null}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Edit your profile"
          onPress={editing ? cancelEdit : startEdit}
          hitSlop={10}
        >
          <Icon name={editing ? 'x' : 'edit-2'} size={18} color={MUTE} />
        </Pressable>
      </View>

      {bio && !editing ? <VoicedNote note={bio} style={styles.bio} /> : null}

      {editing ? (
        <View style={styles.editCard}>
          <Text style={styles.editLabel}>Name</Text>
          <TextInput
            accessibilityLabel="Edit display name"
            value={nameDraft}
            onChangeText={setNameDraft}
            style={styles.editInput}
            selectionColor={CORAL}
            maxLength={60}
          />
          <Text style={[styles.editLabel, { marginTop: 12 }]}>Bio</Text>
          <TextInput
            accessibilityLabel="Edit bio"
            value={bioDraft}
            onChangeText={(t) => setBioDraft(t.slice(0, 280))}
            style={[styles.editInput, styles.editInputMulti]}
            selectionColor={CORAL}
            multiline
            placeholder="A line about your taste."
            placeholderTextColor={MUTE}
          />
          <View style={styles.editActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Save profile"
              onPress={onSaveEdit}
              disabled={updateProfile.isPending}
              style={styles.editSaveBtn}
            >
              <Text style={styles.editSaveLabel}>
                {updateProfile.isPending ? 'Saving…' : 'Save'}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel editing"
              onPress={cancelEdit}
              style={styles.editCancelBtn}
            >
              <Text style={styles.editCancelLabel}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {/* 2. Taste identity card — the anti-dating affordance turned inward. */}
      <View style={styles.identityCard}>
        <Text style={styles.eyebrowGold}>YOUR TASTE</Text>
        {tasteQ.isLoading || placesQ.isLoading ? (
          <Text style={styles.readoutPrompt}>…</Text>
        ) : tasteQ.isError || placesQ.isError ? (
          <LoadError
            message="Couldn't load your taste."
            onRetry={() => {
              tasteQ.refetch();
              placesQ.refetch();
            }}
          />
        ) : readout.length > 0 ? (
          <Text style={styles.readout}>{readout.join(' · ')}.</Text>
        ) : lovedPlaces.length > 0 ? (
          // tasteReadout only names axes with a clear lean (±0.25) — a few
          // loves can sit near-neutral and legitimately produce nothing to
          // say yet. Never claim they haven't logged when the stat below
          // shows they have.
          <Text style={styles.readoutPrompt}>
            Your taste is still finding its shape — a few more loves will sharpen it.
          </Text>
        ) : (
          <Text style={styles.readoutPrompt}>
            Log a few places you love and your taste takes shape here.
          </Text>
        )}
        <Text style={styles.identityStats}>
          {lovedPlaces.length} love{lovedPlaces.length === 1 ? '' : 's'} · {hubCount} neighbourhood
          {hubCount === 1 ? '' : 's'}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="See your map as others do"
          disabled={!viewerId}
          onPress={() => viewerId && router.push(`/(tabs)/person/${viewerId}` as never)}
        >
          <Text style={styles.identityCta}>See your map as others do ›</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Share your taste"
          onPress={onShareTaste}
          style={styles.shareTastePill}
        >
          <Text style={styles.shareTastePillLabel}>Share your taste ›</Text>
        </Pressable>
      </View>

      <TasteShareCard
        visible={shareVisible}
        onClose={() => setShareVisible(false)}
        axes={tasteQ.data?.axes ?? ZERO_AXES}
        readout={readout}
        lovedCount={lovedPlaces.length}
        hubCount={hubCount}
        places={shareCardPlaces}
        inviteText={buildPersonalInviteText(viewerId)}
      />

      {/* 3. Your voice — the notes are the moat; this surface farms them. */}
      <View style={{ marginTop: 30 }}>
        <Eyebrow>Your voice</Eyebrow>
        {placesQ.isLoading ? (
          <Text style={styles.empty}>Loading…</Text>
        ) : placesQ.isError ? (
          <LoadError message="Couldn't load your notes." onRetry={() => placesQ.refetch()} />
        ) : (
          <View style={{ marginTop: 12 }}>
            <Text style={styles.voiceCount}>
              {voicedPlaces.length} note{voicedPlaces.length === 1 ? '' : 's'} written
            </Text>
            {latestVoiced?.note ? (
              <VoicedNote note={latestVoiced.note} numberOfLines={3} style={styles.voicePreview} />
            ) : null}
            {lovedWithoutNote > 0 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Log a place"
                onPress={() => router.push('/(tabs)/add' as never)}
                style={styles.nudgeCard}
              >
                <Text style={styles.nudgeText}>
                  {lovedWithoutNote} loved place{lovedWithoutNote === 1 ? '' : 's'}{' '}
                  {lovedWithoutNote === 1 ? 'is' : 'are'} still waiting for your words. ›
                </Text>
              </Pressable>
            ) : lovedMissingOrder > 0 ? (
              // The lower-priority sibling nudge — never stacked under the
              // notes one: one ask at a time, not a guilt pile.
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Log a place"
                onPress={() => router.push('/(tabs)/add' as never)}
                style={styles.nudgeCard}
              >
                <Text style={styles.nudgeText}>
                  {lovedMissingOrder} loved place{lovedMissingOrder === 1 ? '' : 's'}{' '}
                  {lovedMissingOrder === 1 ? 'is' : 'are'} missing the order. ›
                </Text>
              </Pressable>
            ) : null}
          </View>
        )}
      </View>

      {/* 4. Lists — curated shelves. */}
      <View style={{ marginTop: 30 }}>
        <View style={styles.listsHeader}>
          <Eyebrow>Lists</Eyebrow>
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
        ) : listsQ.isError ? (
          <LoadError message="Couldn't load your lists." onRetry={() => listsQ.refetch()} />
        ) : (listsQ.data ?? []).length === 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Make your first list"
            onPress={() => router.push('/(tabs)/list/new' as never)}
            style={styles.emptyCard}
          >
            <Text style={styles.emptyTitle}>No lists yet.</Text>
            <Text style={styles.emptyBody}>
              Curated shelves — "Date-night bets," "Solo coffee." Tap to start one.
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

      {/* 5. Reach — borrowing framing, never bare "followers/following". */}
      <View style={{ marginTop: 30 }}>
        <Eyebrow>Reach</Eyebrow>
        {reachQ.isError ? (
          <LoadError message="Couldn't load your reach." onRetry={() => reachQ.refetch()} />
        ) : (
          <View style={styles.reachCard}>
            <Text style={styles.reachLine}>
              {borrowers} {borrowers === 1 ? 'person' : 'people'} borrowing your map
            </Text>
            <Text style={styles.reachSub}>
              Following {following} map{following === 1 ? '' : 's'}
            </Text>
          </View>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Invite someone"
          onPress={onInvite}
          style={styles.inviteCard}
        >
          <Text style={styles.inviteTitle}>Bring someone whose taste you trust.</Text>
          <Text style={styles.inviteBody}>
            Their map makes yours better — send them your link on WhatsApp. ›
          </Text>
        </Pressable>
      </View>

      {/* 6. Account. */}
      <View style={{ marginTop: 30, marginBottom: 80 }}>
        <Eyebrow>Account</Eyebrow>
        <View style={styles.accountCard}>
          <Text style={styles.accountLabel}>Who can see your notes</Text>
          <View style={styles.visRow}>
            {VISIBILITY_OPTIONS.map((opt) => {
              const selected =
                (profile.data?.default_visibility ?? 'friends_of_friends') === opt.key;
              return (
                <Pressable
                  key={opt.key}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`Visibility: ${opt.label}`}
                  onPress={() => onSetVisibility(opt.key)}
                  style={[styles.visChip, selected && styles.visChipOn]}
                >
                  <Text style={[styles.visChipLabel, selected && styles.visChipLabelOn]}>
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="House rules"
          onPress={() => router.push('/(tabs)/house-rules' as never)}
          style={styles.linkRow}
        >
          <Text style={styles.linkRowText}>House rules</Text>
          <Text style={styles.chevron}>›</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sign out"
          onPress={onSignOut}
          style={styles.linkRow}
        >
          <Text style={[styles.linkRowText, { color: '#B23A14' }]}>Sign out</Text>
        </Pressable>
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingTop: 8 },
  name: { fontFamily: SERIF, fontSize: TASTE_TYPE_SCALE.display, color: INK, letterSpacing: -0.5 },
  handle: { fontFamily: SANS_SEMI, fontSize: TASTE_TYPE_SCALE.body, color: MUTE, marginTop: 3 },
  bio: { marginTop: 10 },

  editCard: {
    marginTop: 14,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: HAIR,
    backgroundColor: CARD,
  },
  editLabel: {
    fontFamily: SANS_BOLD,
    fontSize: 10.5,
    letterSpacing: 1,
    color: MUTE,
    textTransform: 'uppercase',
  },
  editInput: {
    fontFamily: SANS,
    fontSize: TASTE_TYPE_SCALE.emphasis,
    color: INK,
    marginTop: 6,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: HAIR,
  },
  editInputMulti: { minHeight: 60, textAlignVertical: 'top' },
  editActions: { flexDirection: 'row', gap: 8, marginTop: 14 },
  editSaveBtn: {
    backgroundColor: CORAL,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  editSaveLabel: { fontFamily: SANS_SEMI, fontSize: TASTE_TYPE_SCALE.body, color: '#FFFFFF' },
  editCancelBtn: {
    borderWidth: 1,
    borderColor: HAIR,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  editCancelLabel: { fontFamily: SANS_SEMI, fontSize: TASTE_TYPE_SCALE.body, color: INK },

  identityCard: {
    marginTop: 22,
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: HAIR,
    backgroundColor: CARD,
  },
  eyebrowGold: {
    fontFamily: SANS_BOLD,
    fontSize: TASTE_TYPE_SCALE.micro,
    letterSpacing: 1.6,
    color: GOLD,
  },
  readout: {
    fontFamily: SERIF,
    fontSize: 21,
    lineHeight: 28,
    color: INK,
    letterSpacing: -0.3,
    marginTop: 6,
  },
  readoutPrompt: {
    fontFamily: SANS,
    fontSize: TASTE_TYPE_SCALE.subhead,
    lineHeight: 21,
    color: MUTE,
    marginTop: 6,
  },
  identityStats: {
    fontFamily: SANS_SEMI,
    fontSize: TASTE_TYPE_SCALE.body,
    color: MUTE,
    marginTop: 10,
  },
  identityCta: {
    fontFamily: SANS_SEMI,
    fontSize: TASTE_TYPE_SCALE.body,
    color: CORAL,
    marginTop: 10,
  },
  shareTastePill: {
    alignSelf: 'flex-start',
    marginTop: 14,
    borderWidth: 1,
    borderColor: HAIR,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  shareTastePillLabel: { fontFamily: SANS_SEMI, fontSize: 12.5, color: INK },

  empty: { fontFamily: SANS, fontSize: TASTE_TYPE_SCALE.body, color: MUTE, marginTop: 12 },
  voiceCount: { fontFamily: SANS_SEMI, fontSize: TASTE_TYPE_SCALE.subhead, color: INK },
  voicePreview: { marginTop: 6 },
  nudgeCard: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: HAIR,
    backgroundColor: TINT,
  },
  nudgeText: { fontFamily: SANS_SEMI, fontSize: TASTE_TYPE_SCALE.body, color: INK },

  listsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  newListLink: { fontFamily: SANS_SEMI, fontSize: TASTE_TYPE_SCALE.body, color: CORAL },
  listCard: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: HAIR,
    backgroundColor: CARD,
  },
  listTitle: { fontFamily: SANS_SEMI, fontSize: TASTE_TYPE_SCALE.emphasis, color: INK },
  listSub: { fontFamily: SANS, fontSize: TASTE_TYPE_SCALE.label, color: MUTE, marginTop: 4 },
  emptyCard: {
    marginTop: 14,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: HAIR,
    backgroundColor: CARD,
  },
  emptyTitle: { fontFamily: SERIF, fontSize: 20, color: INK, letterSpacing: -0.4 },
  emptyBody: {
    fontFamily: SANS,
    fontSize: TASTE_TYPE_SCALE.body,
    lineHeight: 20,
    color: MUTE,
    marginTop: 8,
  },

  reachCard: {
    marginTop: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: HAIR,
    backgroundColor: CARD,
  },
  reachLine: {
    fontFamily: SERIF,
    fontSize: TASTE_TYPE_SCALE.headline,
    color: INK,
    letterSpacing: -0.3,
  },
  reachSub: { fontFamily: SANS, fontSize: TASTE_TYPE_SCALE.body, color: MUTE, marginTop: 4 },
  inviteCard: {
    marginTop: 10,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: HAIR,
    backgroundColor: CARD,
  },
  inviteTitle: { fontFamily: SERIF, fontSize: 17, color: INK, letterSpacing: -0.3 },
  inviteBody: {
    fontFamily: SANS,
    fontSize: TASTE_TYPE_SCALE.body,
    lineHeight: 19,
    color: MUTE,
    marginTop: 6,
  },

  accountCard: {
    marginTop: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: HAIR,
    backgroundColor: CARD,
  },
  accountLabel: {
    fontFamily: SANS_BOLD,
    fontSize: 10.5,
    letterSpacing: 1,
    color: MUTE,
    textTransform: 'uppercase',
  },
  visRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  visChip: {
    borderWidth: 1,
    borderColor: HAIR,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  visChipOn: { backgroundColor: CORAL, borderColor: CORAL },
  visChipLabel: { fontFamily: SANS_SEMI, fontSize: 12.5, color: INK },
  visChipLabelOn: { color: '#FFFFFF' },

  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: HAIR,
  },
  linkRowText: { fontFamily: SANS_SEMI, fontSize: 14.5, color: INK },
  chevron: { fontFamily: SANS, fontSize: TASTE_TYPE_SCALE.headline, color: '#B7AE9F' },
});
