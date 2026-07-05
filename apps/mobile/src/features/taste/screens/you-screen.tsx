import { Eyebrow, Face, Icon, Page, StatusSpace } from '@/components';
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
import { type Visibility, ZERO_AXES } from '@journal/shared';
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

const CORAL = '#FF4D2E';
const INK = '#1B1714';
const MUTE = '#7A716A';
const HAIR = '#E7E1D7';
const CARD = '#FFFFFF';
const TINT = '#FAF6F0';

const SERIF = 'Fraunces_500';
const SERIF_IT = 'Fraunces_400Italic';
const SANS = 'HankenGrotesk_400Regular';
const SANS_SEMI = 'HankenGrotesk_600SemiBold';
const SANS_BOLD = 'HankenGrotesk_700Bold';

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

  // Feed the share card named loves — flatMap over a type guard keeps TS
  // happy without a verbose predicate function for the nullable `place`.
  const shareCardPlaces = useMemo(
    () => lovedPlaces.flatMap((p) => (p.place ? [{ name: p.place.name, note: p.note }] : [])),
    [lovedPlaces],
  );

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

  const onInvite = () => {
    log.event('you.invite_tapped');
    Linking.openURL(buildWhatsAppLink(buildPersonalInviteText(viewerId))).catch(() => undefined);
  };

  const onShareTaste = () => {
    log.event('you.share_taste_tapped');
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

      {bio && !editing ? <Text style={styles.bio}>"{bio}"</Text> : null}

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
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="See your map as others do"
        disabled={!viewerId}
        onPress={() => viewerId && router.push(`/(tabs)/person/${viewerId}` as never)}
        style={styles.identityCard}
      >
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
          {lovedPlaces.length} love{lovedPlaces.length === 1 ? '' : 's'} · {hubCount} hub
          {hubCount === 1 ? '' : 's'}
        </Text>
        <Text style={styles.identityCta}>See your map as others do ›</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Share your taste"
          onPress={onShareTaste}
          style={styles.shareTastePill}
        >
          <Text style={styles.shareTastePillLabel}>Share your taste ›</Text>
        </Pressable>
      </Pressable>

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
        ) : (
          <View style={{ marginTop: 12 }}>
            <Text style={styles.voiceCount}>
              {voicedPlaces.length} note{voicedPlaces.length === 1 ? '' : 's'} written
            </Text>
            {latestVoiced?.note ? (
              <Text style={styles.voicePreview} numberOfLines={3}>
                "{latestVoiced.note}"
              </Text>
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
        <View style={styles.reachCard}>
          <Text style={styles.reachLine}>
            {borrowers} {borrowers === 1 ? 'person' : 'people'} borrowing your map
          </Text>
          <Text style={styles.reachSub}>
            Following {following} map{following === 1 ? '' : 's'}
          </Text>
        </View>
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
  name: { fontFamily: SERIF, fontSize: 28, color: INK, letterSpacing: -0.5 },
  handle: { fontFamily: SANS_SEMI, fontSize: 13, color: MUTE, marginTop: 3 },
  bio: {
    fontFamily: SERIF_IT,
    fontSize: 14.5,
    lineHeight: 21,
    color: INK,
    marginTop: 10,
  },

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
    fontSize: 15,
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
  editSaveLabel: { fontFamily: SANS_SEMI, fontSize: 13, color: '#FFFFFF' },
  editCancelBtn: {
    borderWidth: 1,
    borderColor: HAIR,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  editCancelLabel: { fontFamily: SANS_SEMI, fontSize: 13, color: INK },

  identityCard: {
    marginTop: 22,
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: HAIR,
    backgroundColor: CARD,
  },
  eyebrowGold: { fontFamily: SANS_BOLD, fontSize: 10, letterSpacing: 1.6, color: '#C8A24A' },
  readout: {
    fontFamily: SERIF,
    fontSize: 21,
    lineHeight: 28,
    color: INK,
    letterSpacing: -0.3,
    marginTop: 6,
  },
  readoutPrompt: { fontFamily: SANS, fontSize: 14, lineHeight: 21, color: MUTE, marginTop: 6 },
  identityStats: { fontFamily: SANS_SEMI, fontSize: 13, color: MUTE, marginTop: 10 },
  identityCta: { fontFamily: SANS_SEMI, fontSize: 13, color: CORAL, marginTop: 10 },
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

  empty: { fontFamily: SANS, fontSize: 13, color: MUTE, marginTop: 12 },
  voiceCount: { fontFamily: SANS_SEMI, fontSize: 14, color: INK },
  voicePreview: {
    fontFamily: SERIF_IT,
    fontSize: 14.5,
    lineHeight: 21,
    color: INK,
    marginTop: 6,
  },
  nudgeCard: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: HAIR,
    backgroundColor: TINT,
  },
  nudgeText: { fontFamily: SANS_SEMI, fontSize: 13, color: INK },

  listsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  newListLink: { fontFamily: SANS_SEMI, fontSize: 13, color: CORAL },
  listCard: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: HAIR,
    backgroundColor: CARD,
  },
  listTitle: { fontFamily: SANS_SEMI, fontSize: 15, color: INK },
  listSub: { fontFamily: SANS, fontSize: 12, color: MUTE, marginTop: 4 },
  emptyCard: {
    marginTop: 14,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: HAIR,
    backgroundColor: CARD,
  },
  emptyTitle: { fontFamily: SERIF, fontSize: 20, color: INK, letterSpacing: -0.4 },
  emptyBody: { fontFamily: SANS, fontSize: 13, lineHeight: 20, color: MUTE, marginTop: 8 },

  reachCard: {
    marginTop: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: HAIR,
    backgroundColor: CARD,
  },
  reachLine: { fontFamily: SERIF, fontSize: 18, color: INK, letterSpacing: -0.3 },
  reachSub: { fontFamily: SANS, fontSize: 13, color: MUTE, marginTop: 4 },
  inviteCard: {
    marginTop: 10,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: HAIR,
    backgroundColor: CARD,
  },
  inviteTitle: { fontFamily: SERIF, fontSize: 17, color: INK, letterSpacing: -0.3 },
  inviteBody: { fontFamily: SANS, fontSize: 13, lineHeight: 19, color: MUTE, marginTop: 6 },

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
  chevron: { fontFamily: SANS, fontSize: 18, color: '#B7AE9F' },
});
