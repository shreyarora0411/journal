import { Eyebrow, Page, StatusSpace } from '@/components';
import { useToast } from '@/hooks/use-toast';
import { log } from '@/lib/log';
import { VOUCH_CATEGORIES, type VouchType, looksSpecific } from '@journal/shared';
import { useRouter } from 'expo-router';
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
 * Add a vouch (Vouched v3.1 — Lists replace trips). One vouch at a time,
 * dropped into a list. Floor: pick category → type one field → set
 * destination → accept the default destination list → save.
 *
 * The category tunes the prompt/placeholder but never constrains how the
 * user phrases the answer. No verdict, no multi-step sequence. The list
 * defaults hard to the destination list (one tap); a custom list name is
 * available but never required.
 */
export function TripComposerScreen() {
  const router = useRouter();
  const toast = useToast();
  const create = useCreateVouch();

  const [vouchType, setVouchType] = useState<VouchType | null>(null);
  const [text, setText] = useState('');
  const [destination, setDestination] = useState('');
  const [customList, setCustomList] = useState('');
  const [showCustom, setShowCustom] = useState(false);

  useEffect(() => {
    log.event('composer.screen_entered');
  }, []);

  const category = VOUCH_CATEGORIES.find((c) => c.type === vouchType) ?? null;
  const canSave = Boolean(vouchType) && text.trim().length > 0 && destination.trim().length > 0;
  const nudge = text.trim().length > 0 && !looksSpecific(text);
  const defaultListLabel = destination.trim() || 'this destination';

  const onSave = async () => {
    if (!canSave || !vouchType) {
      toast.show({ message: 'Pick a category, write the vouch, add where.', variant: 'error' });
      return;
    }
    try {
      const res = await create.mutateAsync({
        vouch_type: vouchType,
        text: text.trim(),
        destination_text: destination.trim(),
        new_list_name: showCustom && customList.trim() ? customList.trim() : null,
        visibility: 'friends_of_friends',
      });
      toast.show({ message: 'Vouch saved to your circle.', variant: 'success' });
      router.replace(`/(tabs)/list/${res.listId}` as never);
    } catch (err) {
      log.error('createVouch failed', err);
      toast.show({ message: 'Could not save. Try again.', variant: 'error' });
    }
  };

  return (
    <Page>
      <StatusSpace />
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Text style={styles.headline}>Add a vouch.</Text>
        <Text style={styles.sub}>One thing you'd tell a friend who's going.</Text>

        {/* Step 1 — category */}
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

        {/* Step 2 — the one field, tuned to the category */}
        {category ? (
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
        ) : null}

        {/* Step 3 — destination */}
        {category ? (
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
        ) : null}

        {/* Step 4 — list (defaults hard to the destination list) */}
        {category && destination.trim().length > 0 ? (
          <View style={styles.field}>
            <Eyebrow color={MUTE}>Which list?</Eyebrow>
            {!showCustom ? (
              <View style={styles.listRow}>
                <View style={styles.defaultListChip}>
                  <Text style={styles.defaultListLabel}>{defaultListLabel}</Text>
                  <Text style={styles.defaultListSub}>default</Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Use a different list"
                  onPress={() => setShowCustom(true)}
                  hitSlop={8}
                >
                  <Text style={styles.changeList}>+ New list</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.listRow}>
                <TextInput
                  accessibilityLabel="New list name"
                  placeholder='e.g. "best mountain stays"'
                  placeholderTextColor={FAINT}
                  value={customList}
                  onChangeText={(v) => setCustomList(v.slice(0, 120))}
                  style={[styles.input, { flex: 1, marginTop: 0 }]}
                  selectionColor={CORAL}
                  autoFocus
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Use the default list"
                  onPress={() => {
                    setShowCustom(false);
                    setCustomList('');
                  }}
                  hitSlop={8}
                >
                  <Text style={styles.changeList}>Default</Text>
                </Pressable>
              </View>
            )}
          </View>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Save vouch"
          onPress={onSave}
          disabled={!canSave || create.isPending}
          style={[styles.cta, (!canSave || create.isPending) && { opacity: 0.5 }]}
        >
          {create.isPending ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.ctaLabel}>Save vouch ✦</Text>
          )}
        </Pressable>
        <View style={{ height: 48 }} />
      </ScrollView>
    </Page>
  );
}

const styles = StyleSheet.create({
  headline: {
    fontFamily: 'PlayfairDisplay_500Medium',
    fontSize: 32,
    lineHeight: 36,
    color: INK,
    letterSpacing: -0.6,
    marginTop: 12,
  },
  sub: { fontFamily: 'DMSans_400Regular', fontSize: 14, lineHeight: 20, color: MUTE, marginTop: 6 },
  field: { marginTop: 24 },
  catRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  catChip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999 },
  catChipOn: { backgroundColor: INK },
  catChipOff: { backgroundColor: TINT, borderWidth: 1, borderColor: HAIR },
  catLabel: { fontFamily: 'DMSans_600SemiBold', fontSize: 13.5 },
  catLabelOn: { color: '#FFFFFF' },
  catLabelOff: { color: MUTE },
  input: {
    marginTop: 8,
    fontFamily: 'DMSans_400Regular',
    fontSize: 17,
    color: INK,
    borderBottomWidth: 1,
    borderBottomColor: HAIR,
    paddingVertical: 8,
  },
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
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10 },
  defaultListChip: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    backgroundColor: TINT,
    borderWidth: 1,
    borderColor: HAIR,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  defaultListLabel: { fontFamily: 'PlayfairDisplay_500Medium', fontSize: 16, color: INK },
  defaultListSub: { fontFamily: 'DMSans_700Bold', fontSize: 9, letterSpacing: 1, color: FAINT },
  changeList: { fontFamily: 'DMSans_600SemiBold', fontSize: 13, color: CORAL },
  cta: {
    backgroundColor: INK,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 28,
  },
  ctaLabel: { fontFamily: 'DMSans_600SemiBold', fontSize: 16, color: '#FFFFFF' },
});
