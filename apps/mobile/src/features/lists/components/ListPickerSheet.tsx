import { useToast } from '@/hooks/use-toast';
import { log } from '@/lib/log';
import type { ListItemTarget } from '@journal/shared';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  useAddPolymorphicListItem,
  useRemovePolymorphicListItem,
} from '../api/use-add-polymorphic-item';
import { useMyLists } from '../api/use-lists';
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
  const router = useRouter();
  const toast = useToast();
  const listsQ = useMyLists();
  const containingQ = useListsContaining(targetType, targetId);
  const addMutation = useAddPolymorphicListItem();
  const removeMutation = useRemovePolymorphicListItem();

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

  const onCreateNew = () => {
    onClose();
    // The new-list screen returns to wherever the picker was opened
    // from. The caller can re-open the picker after returning.
    router.push('/(tabs)/list/new');
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

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Create a new list"
            onPress={onCreateNew}
            style={styles.newRow}
          >
            <View style={styles.newGlyph}>
              <Text style={styles.newGlyphText}>+</Text>
            </View>
            <Text style={styles.newLabel}>Create a new list</Text>
          </Pressable>

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
    fontFamily: 'InstrumentSerif_400Italic',
    fontSize: 24,
    color: INK,
    letterSpacing: -0.4,
    marginBottom: 12,
  },
  muted: {
    fontFamily: 'Geist_400Regular',
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
    fontFamily: 'Geist_500Medium',
    fontSize: 15,
    color: INK,
  },
  rowSub: {
    fontFamily: 'Geist_400Regular',
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
    fontFamily: 'Geist_500Medium',
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
    fontFamily: 'Geist_500Medium',
    fontSize: 18,
    lineHeight: 18,
  },
  newLabel: {
    fontFamily: 'Geist_500Medium',
    fontSize: 15,
    color: INK,
  },
  done: {
    marginTop: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  doneLabel: {
    fontFamily: 'Geist_500Medium',
    fontSize: 14,
    color: MUTE,
  },
});
