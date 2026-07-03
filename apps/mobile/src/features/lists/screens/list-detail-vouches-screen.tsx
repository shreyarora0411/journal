import { Face, Page, StatusSpace } from '@/components';
import { useAuthStore } from '@/features/auth';
import { useRecordInteraction } from '@/features/search';
import { useDeleteVouch, useUpdateVouch } from '@/features/trips';
import { useToast } from '@/hooks/use-toast';
import { log } from '@/lib/log';
import type { VouchType } from '@journal/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { type ListVouch, useListVouches } from '../api/use-list-vouches';
import { useList, useRenameList } from '../api/use-lists';
import { AddExistingVouchSheet } from '../components/AddExistingVouchSheet';

const INK = '#1A1410';
const MUTE = '#7A716A';
const FAINT = '#B7AE9F';
const HAIR = '#EFEAE2';
const CORAL = '#FF4D2E';

const TYPE_LABEL: Record<VouchType, string> = {
  stay: 'Stay',
  eat_drink: 'Eat / Drink',
  do: 'Do',
  nightlife: 'Nightlife',
  good_to_know: 'Good to know',
  skip: 'Skip',
};
const TYPE_ORDER: VouchType[] = ['stay', 'eat_drink', 'do', 'nightlife', 'good_to_know', 'skip'];

// Vouch types that map to a physical place worth opening in Maps.
const PLACE_TYPES = new Set<VouchType>(['stay', 'eat_drink', 'do', 'nightlife']);
// Lead phrase before the first dash/comma is usually the venue name.
const mapsUrl = (text: string, dest: string) => {
  const lead = text.split(/[—–\-,.]/)[0]?.trim() || text;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lead}, ${dest}`)}`;
};

/**
 * List detail (v3.1, scannable). Vouches grouped by category, with a count
 * per section and collapse toggles so a 25-vouch trip stays navigable. When
 * a section spans multiple destinations (a trip list like Bangkok+Phangan+
 * Samui), a small destination sub-label separates them.
 */
export function ListDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const listQ = useList(id ?? null);
  const vouchesQ = useListVouches(id ?? null);
  const meId = useAuthStore((s) => s.session?.user.id ?? null);
  const toast = useToast();
  const updateVouch = useUpdateVouch();
  const deleteVouch = useDeleteVouch();
  const renameList = useRenameList();
  const recordInteraction = useRecordInteraction();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [listDraft, setListDraft] = useState('');
  const [addExistingOpen, setAddExistingOpen] = useState(false);

  useEffect(() => {
    log.event('list.detail_entered', { id });
  }, [id]);

  const vouches = vouchesQ.data ?? [];
  const grouped = useMemo(() => {
    const byType = new Map<VouchType, ListVouch[]>();
    for (const v of vouches) {
      const arr = byType.get(v.vouch_type) ?? [];
      arr.push(v);
      byType.set(v.vouch_type, arr);
    }
    return TYPE_ORDER.filter((t) => byType.has(t)).map((t) => {
      const rows = byType.get(t)!;
      // Sub-group by destination, preserving first-seen order.
      const dests: string[] = [];
      const byDest = new Map<string, ListVouch[]>();
      for (const v of rows) {
        const d = v.destination_text || '—';
        if (!byDest.has(d)) {
          byDest.set(d, []);
          dests.push(d);
        }
        byDest.get(d)!.push(v);
      }
      return {
        type: t,
        count: rows.length,
        multiDest: dests.length > 1,
        dests: dests.map((d) => ({ dest: d, rows: byDest.get(d)! })),
      };
    });
  }, [vouches]);

  const list = listQ.data as {
    title?: string;
    owner_id?: string;
    destination_text?: string;
  } | null;
  const isMine = meId === list?.owner_id;

  const onAddVouch = () =>
    router.push({
      pathname: '/(tabs)/add',
      params: {
        listId: id ?? '',
        listTitle: list?.title ?? '',
        destination: list?.destination_text ?? '',
      },
    } as never);

  // Act-on-it — leave the app to actually use a trusted rec. Acting on a
  // friend's vouch is a revealed-trust signal we learn from (migration 51);
  // only record for vouches NOT authored by the viewer (the RPC already
  // no-ops on own, but skipping the call avoids needless noise).
  const openMaps = (v: ListVouch) => {
    if (v.user_id !== meId) recordInteraction.mutate({ vouchId: v.id, kind: 'maps' });
    Linking.openURL(mapsUrl(v.text, v.destination_text)).catch((err) => {
      log.error('open maps failed', err);
      toast.show({ message: 'Could not open Maps.', variant: 'error' });
    });
  };
  const shareVouch = (v: ListVouch) => {
    if (v.user_id !== meId) recordInteraction.mutate({ vouchId: v.id, kind: 'share' });
    const who =
      v.user_id === meId ? 'I' : (v.author?.display_name ?? v.author?.handle ?? 'A friend');
    Share.share({ message: `"${v.text}" — ${who} vouched · ${v.destination_text}` }).catch((err) =>
      log.error('share vouch failed', err),
    );
  };

  // Edit / delete — owner-only (the hooks also enforce it server-side).
  const startEdit = (v: ListVouch) => {
    setEditingId(v.id);
    setDraft(v.text);
  };
  const cancelEdit = () => {
    setEditingId(null);
    setDraft('');
  };
  const onSaveEdit = async (vouchId: string) => {
    try {
      await updateVouch.mutateAsync({ vouchId, text: draft });
      cancelEdit();
      toast.show({ message: 'Updated.', variant: 'success' });
    } catch (err) {
      log.error('update vouch failed', err);
      toast.show({ message: 'Could not update. Try again.', variant: 'error' });
    }
  };
  const onDelete = (v: ListVouch) =>
    Alert.alert('Delete this vouch?', 'It will be removed from your list and search.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteVouch.mutateAsync({ vouchId: v.id });
            toast.show({ message: 'Deleted.', variant: 'success' });
          } catch (err) {
            log.error('delete vouch failed', err);
            toast.show({ message: 'Could not delete. Try again.', variant: 'error' });
          }
        },
      },
    ]);

  // Rename the list — fixes the composer's old permanent-typo lock.
  const startRename = () => {
    setListDraft(list?.title ?? '');
    setRenaming(true);
  };
  const onRename = async () => {
    if (!id) return;
    try {
      await renameList.mutateAsync({ id, title: listDraft });
      setRenaming(false);
      toast.show({ message: 'Renamed.', variant: 'success' });
    } catch (err) {
      log.error('rename list failed', err);
      toast.show({ message: 'Could not rename. Try again.', variant: 'error' });
    }
  };

  return (
    <Page>
      <StatusSpace />
      <ScrollView showsVerticalScrollIndicator={false}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => router.back()}
          hitSlop={8}
        >
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>

        {renaming && isMine ? (
          <View style={styles.renameRow}>
            <TextInput
              accessibilityLabel="List name"
              value={listDraft}
              onChangeText={setListDraft}
              autoFocus
              style={styles.titleInput}
              selectionColor={CORAL}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Save list name"
              onPress={onRename}
              hitSlop={12}
            >
              <Text style={styles.actionPrimary}>Save</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel rename"
              onPress={() => setRenaming(false)}
              hitSlop={12}
            >
              <Text style={styles.actionLabel}>Cancel</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.titleRow}>
            <Text style={styles.title}>{list?.title ?? 'List'}</Text>
            {isMine ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Rename list"
                onPress={startRename}
                hitSlop={8}
              >
                <Text style={styles.renameLink}>Rename</Text>
              </Pressable>
            ) : null}
          </View>
        )}
        <Text style={styles.meta}>
          {isMine ? 'Your list' : 'A list from your circle'} · {vouches.length} vouch
          {vouches.length === 1 ? '' : 'es'}
        </Text>

        {isMine ? (
          <View style={styles.addRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Write a new vouch for this list"
              onPress={onAddVouch}
              style={styles.addBtn}
            >
              <Text style={styles.addLabel}>+ Write a vouch</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add a vouch you've already written"
              onPress={() => setAddExistingOpen(true)}
              style={styles.addBtn}
            >
              <Text style={styles.addLabel}>+ Add existing</Text>
            </Pressable>
          </View>
        ) : null}

        {vouchesQ.isLoading ? (
          <Text style={styles.empty}>Loading…</Text>
        ) : vouches.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No vouches yet.</Text>
            <Text style={styles.emptyBody}>
              {isMine ? 'Add the first one — a place, a dish, a thing to do.' : 'Nothing here yet.'}
            </Text>
          </View>
        ) : (
          <View style={{ marginTop: 18, gap: 10 }}>
            {grouped.map((g) => {
              const isCollapsed = collapsed[g.type] ?? false;
              return (
                <View key={g.type} style={{ gap: 10 }}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${TYPE_LABEL[g.type]} section, ${g.count}, ${isCollapsed ? 'collapsed' : 'expanded'}`}
                    onPress={() => setCollapsed((c) => ({ ...c, [g.type]: !isCollapsed }))}
                    style={styles.sectionHeader}
                  >
                    <View style={styles.sectionDot} />
                    <Text style={styles.sectionLabel}>{TYPE_LABEL[g.type].toUpperCase()}</Text>
                    <Text style={styles.sectionCount}>{g.count}</Text>
                    <View style={{ flex: 1 }} />
                    <Text style={styles.chevron}>{isCollapsed ? '▸' : '▾'}</Text>
                  </Pressable>

                  {!isCollapsed
                    ? g.dests.map((d) => (
                        <View key={d.dest} style={{ gap: 10 }}>
                          {g.multiDest ? <Text style={styles.destSub}>{d.dest}</Text> : null}
                          {d.rows.map((v) => {
                            const who = v.author?.display_name ?? v.author?.handle ?? 'Someone';
                            const mine = v.user_id === meId;
                            const editing = editingId === v.id;
                            return (
                              <View key={v.id} style={styles.vouchCard}>
                                {editing ? (
                                  <>
                                    <TextInput
                                      accessibilityLabel="Edit vouch"
                                      value={draft}
                                      onChangeText={(t) => setDraft(t.slice(0, 500))}
                                      multiline
                                      autoFocus
                                      style={styles.editInput}
                                      selectionColor={CORAL}
                                    />
                                    <View style={styles.actions}>
                                      <Pressable
                                        accessibilityRole="button"
                                        accessibilityLabel="Save edit"
                                        onPress={() => onSaveEdit(v.id)}
                                        disabled={updateVouch.isPending}
                                        hitSlop={12}
                                        style={styles.actionBtn}
                                      >
                                        <Text style={styles.actionPrimary}>Save</Text>
                                      </Pressable>
                                      <Pressable
                                        accessibilityRole="button"
                                        accessibilityLabel="Cancel edit"
                                        onPress={cancelEdit}
                                        hitSlop={12}
                                        style={styles.actionBtn}
                                      >
                                        <Text style={styles.actionLabel}>Cancel</Text>
                                      </Pressable>
                                    </View>
                                  </>
                                ) : (
                                  <>
                                    <Text style={styles.vouchText}>"{v.text}"</Text>
                                    <View style={styles.byRow}>
                                      <Face
                                        uri={v.author?.avatar_url ?? null}
                                        initials={who.slice(0, 2).toUpperCase()}
                                        size="sm"
                                      />
                                      <Text style={styles.byWho}>
                                        {who}
                                        {!g.multiDest && v.destination_text ? (
                                          <Text style={styles.byPlace}>
                                            {' · '}
                                            {v.destination_text}
                                          </Text>
                                        ) : null}
                                      </Text>
                                    </View>
                                    <View style={styles.actions}>
                                      {PLACE_TYPES.has(v.vouch_type) ? (
                                        <Pressable
                                          accessibilityRole="button"
                                          accessibilityLabel="Open in Maps"
                                          onPress={() => openMaps(v)}
                                          hitSlop={12}
                                          style={styles.actionBtn}
                                        >
                                          <Text style={styles.actionLabel}>↗ Maps</Text>
                                        </Pressable>
                                      ) : null}
                                      <Pressable
                                        accessibilityRole="button"
                                        accessibilityLabel="Share this vouch"
                                        onPress={() => shareVouch(v)}
                                        hitSlop={12}
                                        style={styles.actionBtn}
                                      >
                                        <Text style={styles.actionLabel}>Share</Text>
                                      </Pressable>
                                      {mine ? (
                                        <>
                                          <View style={{ flex: 1 }} />
                                          <Pressable
                                            accessibilityRole="button"
                                            accessibilityLabel="Edit vouch"
                                            onPress={() => startEdit(v)}
                                            hitSlop={12}
                                            style={styles.actionBtn}
                                          >
                                            <Text style={styles.actionLabel}>Edit</Text>
                                          </Pressable>
                                          <Pressable
                                            accessibilityRole="button"
                                            accessibilityLabel="Delete vouch"
                                            onPress={() => onDelete(v)}
                                            hitSlop={12}
                                            style={styles.actionBtn}
                                          >
                                            <Text style={styles.actionDanger}>Delete</Text>
                                          </Pressable>
                                        </>
                                      ) : null}
                                    </View>
                                  </>
                                )}
                              </View>
                            );
                          })}
                        </View>
                      ))
                    : null}
                </View>
              );
            })}
          </View>
        )}
        <View style={{ height: 48 }} />
      </ScrollView>

      {id ? (
        <AddExistingVouchSheet
          listId={id}
          isOpen={addExistingOpen}
          onClose={() => setAddExistingOpen(false)}
        />
      ) : null}
    </Page>
  );
}

const styles = StyleSheet.create({
  back: { fontFamily: 'DMSans_600SemiBold', fontSize: 14, color: MUTE, marginTop: 4 },
  title: {
    fontFamily: 'PlayfairDisplay_500Medium',
    fontSize: 34,
    lineHeight: 38,
    color: INK,
    letterSpacing: -0.8,
    marginTop: 8,
  },
  meta: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: MUTE, marginTop: 6 },
  addRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16 },
  addBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#FAF6F0',
    borderWidth: 1,
    borderColor: HAIR,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  addLabel: { fontFamily: 'DMSans_600SemiBold', fontSize: 13, color: INK },
  empty: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: MUTE, marginTop: 20 },
  emptyCard: {
    marginTop: 20,
    padding: 18,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: HAIR,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
  },
  emptyTitle: { fontFamily: 'PlayfairDisplay_500Medium', fontSize: 20, color: INK },
  emptyBody: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    lineHeight: 20,
    color: MUTE,
    marginTop: 6,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 14,
    paddingBottom: 2,
  },
  sectionDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: CORAL },
  sectionLabel: { fontFamily: 'DMSans_700Bold', fontSize: 11, letterSpacing: 1.4, color: INK },
  sectionCount: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 11,
    letterSpacing: 0.4,
    color: FAINT,
    marginLeft: 2,
  },
  chevron: { fontSize: 12, color: FAINT },
  destSub: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 13,
    color: INK,
    marginTop: 2,
    letterSpacing: 0.2,
  },
  vouchCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: HAIR,
    padding: 14,
  },
  vouchText: {
    fontFamily: 'PlayfairDisplay_500Medium_Italic',
    fontSize: 17,
    lineHeight: 24,
    color: INK,
  },
  byRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  byWho: { fontFamily: 'DMSans_600SemiBold', fontSize: 13, color: MUTE },
  byPlace: { fontFamily: 'DMSans_700Bold', fontSize: 13, color: INK },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
  },
  renameLink: { fontFamily: 'DMSans_600SemiBold', fontSize: 13, color: CORAL, paddingBottom: 6 },
  renameRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  titleInput: {
    flex: 1,
    fontFamily: 'PlayfairDisplay_500Medium',
    fontSize: 26,
    color: INK,
    borderBottomWidth: 1,
    borderBottomColor: HAIR,
    paddingVertical: 4,
  },
  editInput: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 16,
    lineHeight: 24,
    color: INK,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  actionBtn: {
    borderWidth: 1,
    borderColor: HAIR,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  actionLabel: { fontFamily: 'DMSans_600SemiBold', fontSize: 12, color: INK },
  actionPrimary: { fontFamily: 'DMSans_600SemiBold', fontSize: 12, color: CORAL },
  actionDanger: { fontFamily: 'DMSans_600SemiBold', fontSize: 12, color: '#B23A14' },
});
