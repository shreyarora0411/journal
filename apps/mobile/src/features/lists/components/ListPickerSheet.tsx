import { useToast } from '@/hooks/use-toast';
import { log } from '@/lib/log';
import type { ListItemTarget } from '@journal/shared';
import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  useAddPolymorphicListItem,
  useRemovePolymorphicListItem,
} from '../api/use-add-polymorphic-item';
import { useCreateList, useMyLists } from '../api/use-lists';
import { useListsContaining } from '../api/use-lists-containing';

const INK = '#1A1410';
const MUTE = '#7A716A';
const HAIR = '#EFEAE2';
const TINT = '#FAF6F0';
const CORAL = '#FF4D2E';
const EMERALD = '#00A67E';
const PAPER = '#FFFFFF';

export type ListPickerSheetProps = {
  /** The thing being added to a list — trip / city / venue UUID. */
  targetType: ListItemTarget;
  targetId: string;
  /** Open / close. */
  isOpen: boolean;
  onClose: () => void;
  /** Optional callback fired after a successful add. */
  onItemAdded?: (listId: string) => void;
};

/**
 * Bottom-sheet style picker for adding the given (targetType, targetId)
 * to one of the caller's lists. Tap a list to add; if the item is
 * already in a list it shows a check and the tap removes it. The
 * "+ Create new list" row routes to /(tabs)/list/new with a `returnTo`
 * param so the new list isn't lost.
 *
 * Built on RN Modal — no third-party bottom-sheet dep. Slide animation
 * via the `slide` modal animationType.
 */
export function ListPickerSheet({
  targetType,
  targetId,
  isOpen,
  onClose,
  onItemAdded,
}: ListPickerSheetProps) {
  const toast = useToast();
  const listsQ = useMyLists();
  const containingQ = useListsContaining(targetType, targetId);
  const addMutation = useAddPolymorphicListItem();
  const removeMutation = useRemovePolymorphicListItem();
  const createList = useCreateList();

  const [createMode, setCreateMode] = useState(false);
  const [newListName, setNewListName] = useState('');

  const containingSet = useMemo(() => new Set(containingQ.data ?? []), [containingQ.data]);

  const onToggle = async (listId: string, listTitle: string) => {
    try {
      if (containingSet.has(listId)) {
        await removeMutation.mutateAsync({
          list_id: listId,
          target_type: targetType,
          target_id: targetId,
        });
        toast.show({ message: `Removed from ${listTitle}.`, variant: 'success' });
      } else {
        await addMutation.mutateAsync({
          list_id: listId,
          target_type: targetType,
          target_id: targetId,
        });
        toast.show({ message: `Added to ${listTitle}.`, variant: 'success' });
        onItemAdded?.(listId);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not save.';
      toast.show({ message: msg, variant: 'error' });
      log.warn('list picker toggle failed', { error: msg });
    }
  };

  /** Switch the "+ Create new list" row into an inline input. */
  const onStartCreate = () => {
    setCreateMode(true);
    setNewListName('');
  };

  const onCancelCreate = () => {
    setCreateMode(false);
    setNewListName('');
  };

  /**
   * Inline create: post the list + auto-add the current target to it,
   * then exit create mode. Stays in the same sheet — no route push,
   * no second screen. The new list animates into the list-of-lists
   * with a ✓ on the next render because containingQ refetches via the
   * mutation's onSuccess invalidation.
   */
  const onSubmitCreate = async () => {
    const name = newListName.trim();
    if (name.length === 0) {
      toast.show({ message: 'Give the list a name.', variant: 'error' });
      return;
    }
    try {
      const newList = await createList.mutateAsync({ title: name });
      await addMutation.mutateAsync({
        list_id: newList.id,
        target_type: targetType,
        target_id: targetId,
      });
      toast.show({ message: `Saved to ${newList.title}.`, variant: 'success' });
      onItemAdded?.(newList.id);
      setCreateMode(false);
      setNewListName('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not create the list.';
      toast.show({ message: msg, variant: 'error' });
      log.warn('list inline-create failed', { error: msg });
    }
  };

  const lists = listsQ.data ?? [];

  return (
    <Modal
      visible={isOpen}
      onRequestClose={onClose}
      animationType="slide"
      transparent
      statusBarTranslucent
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close picker"
        onPress={onClose}
        style={styles.backdrop}
      />
      <View style={styles.sheetWrap} pointerEvents="box-none">
        <SafeAreaView edges={['bottom']} style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>Save to a list</Text>

          <ScrollView style={{ maxHeight: 360 }} contentContainerStyle={{ paddingBottom: 8 }}>
            {listsQ.isLoading ? (
              <Text style={styles.muted}>Loading lists…</Text>
            ) : lists.length === 0 ? (
              <Text style={styles.muted}>
                No lists yet. Create one to group your favorite places.
              </Text>
            ) : (
              lists.map((l) => {
                const included = containingSet.has(l.id);
                return (
                  <Pressable
                    key={l.id}
                    accessibilityRole="button"
                    accessibilityLabel={included ? `Remove from ${l.title}` : `Add to ${l.title}`}
                    accessibilityState={{ selected: included }}
                    onPress={() => onToggle(l.id, l.title)}
                    style={[styles.row, included && styles.rowActive]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowTitle}>{l.title}</Text>
                      {l.description ? (
                        <Text style={styles.rowSub} numberOfLines={1}>
                          {l.description}
                        </Text>
                      ) : null}
                    </View>
                    <View style={[styles.check, included && styles.checkOn]}>
                      <Text style={[styles.checkGlyph, included && styles.checkGlyphOn]}>
                        {included ? '✓' : '+'}
                      </Text>
                    </View>
                  </Pressable>
                );
              })
            )}
          </ScrollView>

          {createMode ? (
            // Inline create — input + Add. No route push, no extra screen.
            <View style={styles.createRow}>
              <View style={styles.newGlyph}>
                <Text style={styles.newGlyphText}>+</Text>
              </View>
              <TextInput
                accessibilityLabel="New list name"
                placeholder="Name your list"
                placeholderTextColor="#B7AEA5"
                value={newListName}
                onChangeText={(v) => setNewListName(v.slice(0, 80))}
                style={styles.createInput}
                selectionColor={CORAL}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={onSubmitCreate}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cancel new list"
                onPress={onCancelCreate}
                style={styles.createCancel}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.createCancelLabel}>Cancel</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add new list"
                onPress={onSubmitCreate}
                disabled={createList.isPending || addMutation.isPending}
                style={styles.createSubmit}
              >
                <Text style={styles.createSubmitLabel}>
                  {createList.isPending || addMutation.isPending ? '…' : 'Add'}
                </Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Create a new list"
              onPress={onStartCreate}
              style={styles.newRow}
            >
              <View style={styles.newGlyph}>
                <Text style={styles.newGlyphText}>+</Text>
              </View>
              <Text style={styles.newLabel}>Create a new list</Text>
            </Pressable>
          )}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Done"
            onPress={onClose}
            style={styles.done}
          >
            <Text style={styles.doneLabel}>Done</Text>
          </Pressable>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(26, 20, 16, 0.45)',
  },
  sheetWrap: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: PAPER,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 8,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: HAIR,
    marginBottom: 12,
  },
  title: {
    fontFamily: 'PlayfairDisplay_500Medium',
    fontSize: 24,
    color: INK,
    letterSpacing: -0.4,
    marginBottom: 12,
  },
  muted: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    color: MUTE,
    paddingVertical: 24,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: TINT,
    marginBottom: 8,
  },
  rowActive: {
    backgroundColor: 'rgba(0, 166, 126, 0.08)',
  },
  rowTitle: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 15,
    color: INK,
  },
  rowSub: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    color: MUTE,
    marginTop: 2,
  },
  check: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: PAPER,
    borderWidth: 1,
    borderColor: HAIR,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: {
    backgroundColor: EMERALD,
    borderColor: EMERALD,
  },
  checkGlyph: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 16,
    color: MUTE,
  },
  checkGlyphOn: {
    color: PAPER,
  },
  newRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: HAIR,
  },
  newGlyph: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: CORAL,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newGlyphText: {
    color: PAPER,
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 18,
    lineHeight: 18,
  },
  createRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: HAIR,
  },
  createInput: {
    flex: 1,
    fontFamily: 'PlayfairDisplay_500Medium',
    fontSize: 18,
    color: INK,
    paddingVertical: 6,
  },
  createCancel: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  createCancelLabel: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 13,
    color: MUTE,
  },
  createSubmit: {
    backgroundColor: INK,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  createSubmitLabel: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 13,
    color: PAPER,
  },
  newLabel: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 15,
    color: INK,
  },
  done: {
    marginTop: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  doneLabel: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 14,
    color: MUTE,
  },
});
