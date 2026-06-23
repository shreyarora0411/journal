import { Eyebrow, Page, StatusSpace } from '@/components';
import { useToast } from '@/hooks/use-toast';
import { log } from '@/lib/log';
import { VOUCH_CATEGORIES, type VouchType, looksSpecific } from '@journal/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useCreateVouch } from '../index';

const CORAL = '#FF4D2E';
const INK = '#1A1410';
const MUTE = '#7A716A';
const FAINT = '#B7AE9F';
const HAIR = '#EFEAE2';
const TINT = '#FAF6F0';

/**
 * Add vouches (Vouched v3.1 — batch composer). Pick the list ONCE, then
 * rapid-fire vouches into it without routing away. This kills the friction
 * of the old one-at-a-time flow (a real 25-vouch trip is now one session,
 * not 25 trips through the composer).
 *
 * Launchable two ways:
 *   - Add tab (fresh): you name the list (defaults to the destination).
 *   - "+ Add a vouch" from a list: listId/listTitle params prefill + lock
 *     the list, so everything lands in that list.
 *
 * Per vouch: category → one tuned field → destination (defaults to the
 * last one used, so a multi-stop trip rarely retypes). "Save & add another"
 * banks it and stays put. No verdict (the voiced text carries sentiment).
 */
export function TripComposerScreen() {
  const router = useRouter();
  const toast = useToast();
  const create = useCreateVouch();
  const params = useLocalSearchParams<{ listId?: string; listTitle?: string; destination?: string }>();

  // The container, chosen once. If launched from a list, it's fixed.
  const lockedListId = typeof params.listId === 'string' ? params.listId : null;
  const [listName, setListName] = useState(
    typeof params.listTitle === 'string' ? params.listTitle : '',
  );
  // After the first save we have a concrete list id; route all subsequent
  // vouches there explicitly (avoids re-resolving by title each time).
  const [resolvedListId, setResolvedListId] = useState<string | null>(lockedListId);

  const [vouchType, setVouchType] = useState<VouchType | null>(null);
  const [text, setText] = useState('');
  const [destination, setDestination] = useState(
    typeof params.destination === 'string' ? params.destination : '',
  );
  const [banked, setBanked] = useState(0);

  useEffect(() => {
    log.event('composer.screen_entered', { batch: true });
  }, []);

  const category = VOUCH_CATEGORIES.find((c) => c.type === vouchType) ?? null;
  const listChosen = lockedListId != null || listName.trim().length > 0;
  const canSave = listChosen && Boolean(vouchType) && text.trim().length > 0 && destination.trim().length > 0;
  const nudge = text.trim().length > 0 && !looksSpecific(text);

  const onSaveAndNext = async () => {
    if (!canSave || !vouchType) {
      toast.show({ message: 'Pick a list, a category, write the vouch, add where.', variant: 'error' });
      return;
    }
    try {
      const res = await create.mutateAsync({
        vouch_type: vouchType,
        text: text.trim(),
        destination_text: destination.trim(),
        list_id: resolvedListId,
        new_list_name: resolvedListId ? null : listName.trim() || null,
        visibility: 'friends_of_friends',
      });
      setResolvedListId(res.listId); // lock the list for the rest of the session
      setBanked((n) => n + 1);
      setText('');
      setVouchType(null);
      // destination intentionally retained — next stop is usually the same place
      toast.show({ message: 'Banked. Add another or tap Done.', variant: 'success' });
    } catch (err) {
      log.error('createVouch failed', err);
      toast.show({ message: 'Could not save. Try again.', variant: 'error' });
    }
  };

  const onDone = () => {
    if (resolvedListId) router.replace(`/(tabs)/list/${resolvedListId}` as never);
    else router.replace('/(tabs)/book' as never);
  };

  return (
    <Page>
      <StatusSpace />
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.headerRow}>
          <Text style={styles.headline}>Add vouches.</Text>
          {banked > 0 ? (
            <View style={styles.bankChip}>
              <Text style={styles.bankChipLabel}>{banked} banked</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.sub}>Drop as many as you like into one list. They stay in their own voice.</Text>

        {/* The list — chosen once. Locked when launched from a list. */}
        <View style={styles.field}>
          <Eyebrow>To which list?</Eyebrow>
          {lockedListId ? (
            <View style={styles.lockedList}>
              <Text style={styles.lockedListLabel}>{listName || 'This list'}</Text>
            </View>
          ) : (
            <TextInput
              accessibilityLabel="List name"
              placeholder='e.g. "Koh Samui" or "best mountain stays"'
              placeholderTextColor={FAINT}
              value={listName}
              onChangeText={setListName}
              editable={resolvedListId == null /* lock after first save */}
              style={[styles.input, resolvedListId != null && { color: MUTE }]}
              selectionColor={CORAL}
            />
          )}
        </View>

        <View style={styles.divider} />

        {/* Per-vouch: category → field → destination */}
        <View style={styles.field}>
          <Eyebrow>What kind?</Eyebrow>
          <View style={styles.catRow}>
            {VOUCH_CATEGORIES.map((c) => {
              const on = vouchType === c.type;
              return (
                <Pressable
                  key={c.type}
                  accessibilityRole="button"
                  accessibilityLabel={c.prompt}
                  onPress={() => setVouchType(c.type)}
                  style={[styles.catChip, on ? styles.catChipOn : styles.catChipOff]}
                >
                  <Text style={[styles.catLabel, on ? styles.catLabelOn : styles.catLabelOff]}>
                    {c.prompt.replace(/\?$/, '')}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {category ? (
          <>
            <View style={styles.field}>
              <Eyebrow>{category.hint ? `${category.prompt}  ·  ${category.hint}` : category.prompt}</Eyebrow>
              <View style={styles.voiceCard}>
                <TextInput
                  accessibilityLabel="The vouch"
                  placeholder={category.placeholder}
                  placeholderTextColor={FAINT}
                  value={text}
                  onChangeText={(v) => setText(v.slice(0, 500))}
                  multiline
                  style={styles.voiceInput}
                  selectionColor={CORAL}
                  autoFocus
                />
              </View>
              {nudge ? <Text style={styles.nudge}>One place, dish, or specific thing?</Text> : null}
            </View>

            <View style={styles.field}>
              <Eyebrow>Where is this?</Eyebrow>
              <TextInput
                accessibilityLabel="Destination"
                placeholder="Spiti, Bangkok, Goa…"
                placeholderTextColor={FAINT}
                value={destination}
                onChangeText={setDestination}
                style={styles.input}
                selectionColor={CORAL}
              />
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Save and add another"
              onPress={onSaveAndNext}
              disabled={!canSave || create.isPending}
              style={[styles.cta, (!canSave || create.isPending) && { opacity: 0.5 }]}
            >
              {create.isPending ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.ctaLabel}>Save & add another</Text>
              )}
            </Pressable>
          </>
        ) : null}

        {banked > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Done"
            onPress={onDone}
            style={styles.doneBtn}
          >
            <Text style={styles.doneLabel}>Done — see the list ›</Text>
          </Pressable>
        ) : null}
        <View style={{ height: 48 }} />
      </ScrollView>
    </Page>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  headline: {
    fontFamily: 'PlayfairDisplay_500Medium',
    fontSize: 32,
    lineHeight: 36,
    color: INK,
    letterSpacing: -0.6,
  },
  bankChip: { backgroundColor: CORAL, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  bankChipLabel: { fontFamily: 'DMSans_600SemiBold', fontSize: 12, color: '#FFFFFF' },
  sub: { fontFamily: 'DMSans_400Regular', fontSize: 14, lineHeight: 20, color: MUTE, marginTop: 6 },
  field: { marginTop: 22 },
  divider: { height: 1, backgroundColor: HAIR, marginTop: 22 },
  input: {
    marginTop: 8,
    fontFamily: 'DMSans_400Regular',
    fontSize: 17,
    color: INK,
    borderBottomWidth: 1,
    borderBottomColor: HAIR,
    paddingVertical: 8,
  },
  lockedList: {
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: TINT,
    borderWidth: 1,
    borderColor: HAIR,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  lockedListLabel: { fontFamily: 'PlayfairDisplay_500Medium', fontSize: 18, color: INK },
  catRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  catChip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999 },
  catChipOn: { backgroundColor: INK },
  catChipOff: { backgroundColor: TINT, borderWidth: 1, borderColor: HAIR },
  catLabel: { fontFamily: 'DMSans_600SemiBold', fontSize: 13.5 },
  catLabelOn: { color: '#FFFFFF' },
  catLabelOff: { color: MUTE },
  voiceCard: {
    marginTop: 8,
    backgroundColor: TINT,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: HAIR,
    padding: 14,
    minHeight: 96,
  },
  voiceInput: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 16,
    lineHeight: 24,
    color: INK,
    minHeight: 70,
    textAlignVertical: 'top',
  },
  nudge: { fontFamily: 'DMSans_400Regular', fontSize: 12, color: CORAL, marginTop: 6 },
  cta: {
    backgroundColor: INK,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  ctaLabel: { fontFamily: 'DMSans_600SemiBold', fontSize: 16, color: '#FFFFFF' },
  doneBtn: { marginTop: 16, paddingVertical: 14, alignItems: 'center' },
  doneLabel: { fontFamily: 'DMSans_600SemiBold', fontSize: 15, color: CORAL },
});
