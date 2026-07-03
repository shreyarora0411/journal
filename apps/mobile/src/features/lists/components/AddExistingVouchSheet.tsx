import { useMyVouches } from '@/features/trips';
import { useToast } from '@/hooks/use-toast';
import { log } from '@/lib/log';
import type { VouchType } from '@journal/shared';
import { useMemo } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAddVouchToList } from '../api/use-add-vouch-to-list';
import { useListVouches } from '../api/use-list-vouches';

const INK = '#1A1410';
const MUTE = '#7A716A';
const FAINT = '#B7AE9F';
const HAIR = '#EFEAE2';
const TINT = '#FAF6F0';
const CORAL = '#FF4D2E';
const PAPER = '#FFFFFF';

const TYPE_LABEL: Record<VouchType, string> = {
  stay: 'Stay',
  eat_drink: 'Eat / Drink',
  do: 'Do',
  nightlife: 'Nightlife',
  good_to_know: 'Good to know',
  skip: 'Skip',
};

export type AddExistingVouchSheetProps = {
  listId: string;
  isOpen: boolean;
  onClose: () => void;
};

/**
 * Bottom-sheet picker for adding vouches the user ALREADY wrote to this list —
 * the curation gesture alongside "write a new one". Lists the viewer's own
 * vouches minus the ones already in this list; tap a row to add it (the row
 * then drops out as the list refetches). Built on RN Modal, mirroring
 * ListPickerSheet.
 */
export function AddExistingVouchSheet({ listId, isOpen, onClose }: AddExistingVouchSheetProps) {
  const toast = useToast();
  const myVouchesQ = useMyVouches();
  const listVouchesQ = useListVouches(listId);
  const add = useAddVouchToList();

  const memberIds = useMemo(
    () => new Set((listVouchesQ.data ?? []).map((v) => v.id)),
    [listVouchesQ.data],
  );
  const candidates = useMemo(
    () => (myVouchesQ.data ?? []).filter((v) => !memberIds.has(v.id)),
    [myVouchesQ.data, memberIds],
  );
  const hasAny = (myVouchesQ.data ?? []).length > 0;

  const onAdd = async (vouchId: string) => {
    try {
      await add.mutateAsync({ vouchId, listId });
      toast.show({ message: 'Added to list.', variant: 'success' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not add.';
      toast.show({ message: msg, variant: 'error' });
      log.warn('add existing vouch to list failed', { error: msg });
    }
  };

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
          <Text style={styles.title}>Add one you’ve written</Text>

          <ScrollView style={{ maxHeight: 440 }} contentContainerStyle={{ paddingBottom: 8 }}>
            {myVouchesQ.isLoading ? (
              <Text style={styles.muted}>Loading your vouches…</Text>
            ) : candidates.length === 0 ? (
              <Text style={styles.muted}>
                {hasAny
                  ? 'Every vouch you’ve written is already in this list.'
                  : 'You haven’t written any vouches yet — write one to add it.'}
              </Text>
            ) : (
              candidates.map((v) => (
                <Pressable
                  key={v.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Add "${v.text}" to this list`}
                  onPress={() => onAdd(v.id)}
                  disabled={add.isPending}
                  style={styles.row}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={styles.metaRow}>
                      <Text style={styles.type}>
                        {(TYPE_LABEL[v.vouch_type] ?? v.vouch_type).toUpperCase()}
                      </Text>
                      {v.destination_text ? (
                        <>
                          <Text style={styles.dot}>·</Text>
                          <Text style={styles.dest} numberOfLines={1}>
                            {v.destination_text}
                          </Text>
                        </>
                      ) : null}
                    </View>
                    <Text style={styles.quote} numberOfLines={2}>
                      "{v.text}"
                    </Text>
                  </View>
                  <View style={styles.add}>
                    <Text style={styles.addGlyph}>+</Text>
                  </View>
                </Pressable>
              ))
            )}
          </ScrollView>

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
  sheetWrap: { flex: 1, justifyContent: 'flex-end' },
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
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: TINT,
    marginBottom: 8,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  type: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 9.5,
    letterSpacing: 1,
    color: CORAL,
  },
  dot: { color: FAINT, fontSize: 11 },
  // Place stays prominent (matches the visibility fix elsewhere).
  dest: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 11,
    letterSpacing: 0.4,
    color: INK,
    textTransform: 'uppercase',
    flexShrink: 1,
  },
  quote: {
    fontFamily: 'PlayfairDisplay_500Medium_Italic',
    fontSize: 15,
    lineHeight: 21,
    color: INK,
    marginTop: 6,
  },
  add: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: CORAL,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addGlyph: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 18,
    lineHeight: 18,
    color: PAPER,
  },
  done: { marginTop: 8, paddingVertical: 14, alignItems: 'center' },
  doneLabel: { fontFamily: 'DMSans_600SemiBold', fontSize: 14, color: MUTE },
});
