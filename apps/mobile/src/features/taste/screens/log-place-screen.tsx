import { Page, PlacePicker, StatusSpace } from '@/components';
import { useToast } from '@/hooks/use-toast';
import type { PlaceDetails } from '@/lib/google-places';
import { log } from '@/lib/log';
import { FORMAT_TAGS, GURGAON_HUBS, type Sentiment } from '@journal/shared';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLogPlace } from '../api/use-log-place';

const CORAL = '#FF4D2E';
const INK = '#1B1714';
const MUTE = '#8A8178';
const HAIR = '#E7E1D7';
const TINT = '#FAF6F0';

const SERIF = 'Fraunces_500';
const SANS = 'HankenGrotesk_400Regular';
const SANS_SEMI = 'HankenGrotesk_600SemiBold';
const SANS_BOLD = 'HankenGrotesk_700Bold';

const SENTIMENTS: { key: Sentiment; label: string; hint: string }[] = [
  { key: 'loved', label: 'Loved it', hint: 'trains your taste' },
  { key: 'fine', label: 'Fine', hint: 'noted, no signal' },
  { key: 'skip', label: 'Skip', hint: 'private — never shown' },
];

/**
 * Log — the 10-second door (spec §3, screen 2). Place → one-tap sentiment →
 * optional voiced note → optional ≤3 tags → save. Only place + sentiment are
 * required; everything else is best-effort extras. Sentiment is PRIVATE.
 */
export function LogPlaceScreen() {
  const router = useRouter();
  const toast = useToast();
  const logPlace = useLogPlace();

  const [place, setPlace] = useState<PlaceDetails | null>(null);
  const [sentiment, setSentiment] = useState<Sentiment | null>(null);
  const [note, setNote] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [hub, setHub] = useState<string | null>(null);

  useEffect(() => {
    log.event('taste.log_entered');
  }, []);

  const toggleTag = (slug: string) =>
    setTags((prev) =>
      prev.includes(slug)
        ? prev.filter((t) => t !== slug)
        : prev.length < 3
          ? [...prev, slug]
          : prev,
    );

  const reset = () => {
    setPlace(null);
    setSentiment(null);
    setNote('');
    setTags([]);
    setHub(null);
  };

  const onSave = async () => {
    if (!place || !sentiment) return;
    try {
      await logPlace.mutateAsync({
        place,
        sentiment,
        note: note.trim() || undefined,
        tags,
        hub,
        zone: hub ? 'gurgaon' : null,
      });
      toast.show({
        message:
          sentiment === 'loved'
            ? `${place.name} is on your map — your taste just got sharper.`
            : 'Logged. Your map remembers.',
        variant: 'success',
      });
      reset();
    } catch (err) {
      log.error('log place failed', err);
      toast.show({ message: 'Could not save. Try again.', variant: 'error' });
    }
  };

  const canSave = Boolean(place && sentiment) && !logPlace.isPending;

  return (
    <Page>
      <StatusSpace />
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Text style={styles.headline}>Log a place.</Text>
        <Text style={styles.sub}>Your map, your taste — ten seconds.</Text>

        {/* 1. The place */}
        <Text style={styles.eyebrow}>WHERE</Text>
        {place ? (
          <View style={styles.pickedRow}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.pickedName} numberOfLines={1}>
                {place.name}
              </Text>
              <Text style={styles.pickedMeta} numberOfLines={1}>
                {place.locality ?? place.region ?? ''}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Change place"
              onPress={() => setPlace(null)}
              hitSlop={12}
            >
              <Text style={styles.changeLink}>Change</Text>
            </Pressable>
          </View>
        ) : (
          <PlacePicker mode="broad" placeholder="Search the place…" onPick={setPlace} />
        )}

        {/* 2. The one-tap sentiment (required, private) */}
        {place ? (
          <>
            <Text style={styles.eyebrow}>HOW WAS IT?</Text>
            <View style={styles.sentimentRow}>
              {SENTIMENTS.map((s) => {
                const on = sentiment === s.key;
                return (
                  <Pressable
                    key={s.key}
                    accessibilityRole="radio"
                    accessibilityLabel={s.label}
                    accessibilityState={{ selected: on }}
                    onPress={() => setSentiment(s.key)}
                    style={[
                      styles.sentimentBtn,
                      on && s.key === 'loved' && styles.sentimentLovedOn,
                      on && s.key === 'fine' && styles.sentimentFineOn,
                      on && s.key === 'skip' && styles.sentimentSkipOn,
                    ]}
                  >
                    <Text style={[styles.sentimentLabel, on && { color: '#FFFFFF' }]}>
                      {s.label}
                    </Text>
                    <Text style={[styles.sentimentHint, on && { color: '#FFFFFF', opacity: 0.85 }]}>
                      {s.hint}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* 3. The voiced note (optional, public) */}
            <Text style={styles.eyebrow}>SAY IT IN YOUR WORDS (OPTIONAL)</Text>
            <TextInput
              accessibilityLabel="Your note"
              placeholder="“Get the corner table, order the raan…”"
              placeholderTextColor="#B7AE9F"
              value={note}
              onChangeText={(t) => setNote(t.slice(0, 500))}
              multiline
              style={styles.noteInput}
              selectionColor={CORAL}
            />

            {/* 4. Tags (optional, ≤3) */}
            <Text style={styles.eyebrow}>WHAT KIND OF PLACE? (UP TO 3)</Text>
            <View style={styles.tagWrap}>
              {FORMAT_TAGS.map((t) => {
                const on = tags.includes(t.slug);
                return (
                  <Pressable
                    key={t.slug}
                    accessibilityRole="button"
                    accessibilityLabel={t.label}
                    accessibilityState={{ selected: on }}
                    onPress={() => toggleTag(t.slug)}
                    style={[styles.tagChip, on && styles.tagChipOn]}
                  >
                    <Text style={[styles.tagLabel, on && { color: '#FFFFFF' }]}>{t.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            {/* 5. Hub (optional — Gurgaon Phase 0) */}
            <Text style={styles.eyebrow}>HUB (OPTIONAL)</Text>
            <View style={styles.tagWrap}>
              {GURGAON_HUBS.map((h) => {
                const on = hub === h.slug;
                return (
                  <Pressable
                    key={h.slug}
                    accessibilityRole="button"
                    accessibilityLabel={h.label}
                    accessibilityState={{ selected: on }}
                    onPress={() => setHub(on ? null : h.slug)}
                    style={[styles.tagChip, on && styles.tagChipOn]}
                  >
                    <Text style={[styles.tagLabel, on && { color: '#FFFFFF' }]}>{h.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Save to your map"
              onPress={onSave}
              disabled={!canSave}
              style={[styles.save, !canSave && styles.saveDisabled]}
            >
              <Text style={styles.saveLabel}>
                {logPlace.isPending ? 'Saving…' : 'Save to your map'}
              </Text>
            </Pressable>
            {!sentiment ? (
              <Text style={styles.saveHint}>Pick how it was — that's the log.</Text>
            ) : null}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Done logging"
              onPress={() => router.push('/(tabs)/book' as never)}
              hitSlop={8}
              style={{ alignSelf: 'center', marginTop: 14 }}
            >
              <Text style={styles.doneLink}>Back to your map</Text>
            </Pressable>
          </>
        ) : null}
        <View style={{ height: 60 }} />
      </ScrollView>
    </Page>
  );
}

const styles = StyleSheet.create({
  headline: { fontFamily: SERIF, fontSize: 30, color: INK, letterSpacing: -0.6, paddingTop: 8 },
  sub: { fontFamily: SANS, fontSize: 14, color: MUTE, marginTop: 6 },
  eyebrow: {
    fontFamily: SANS_BOLD,
    fontSize: 10,
    letterSpacing: 1.4,
    color: CORAL,
    marginTop: 22,
    marginBottom: 10,
  },
  pickedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: HAIR,
    backgroundColor: TINT,
  },
  pickedName: { fontFamily: SERIF, fontSize: 18, color: INK },
  pickedMeta: { fontFamily: SANS, fontSize: 12.5, color: MUTE, marginTop: 2 },
  changeLink: { fontFamily: SANS_SEMI, fontSize: 13, color: CORAL },
  sentimentRow: { flexDirection: 'row', gap: 8 },
  sentimentBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: HAIR,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    gap: 2,
  },
  sentimentLovedOn: { backgroundColor: CORAL, borderColor: CORAL },
  sentimentFineOn: { backgroundColor: MUTE, borderColor: MUTE },
  sentimentSkipOn: { backgroundColor: INK, borderColor: INK },
  sentimentLabel: { fontFamily: SANS_SEMI, fontSize: 14, color: INK },
  sentimentHint: { fontFamily: SANS, fontSize: 10.5, color: MUTE },
  noteInput: {
    fontFamily: SANS,
    fontSize: 16,
    lineHeight: 23,
    color: INK,
    minHeight: 72,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: HAIR,
    borderRadius: 14,
    padding: 12,
    backgroundColor: '#FFFFFF',
  },
  tagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tagChip: {
    borderWidth: 1,
    borderColor: HAIR,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: '#FFFFFF',
  },
  tagChipOn: { backgroundColor: INK, borderColor: INK },
  tagLabel: { fontFamily: SANS_SEMI, fontSize: 12.5, color: INK },
  save: {
    marginTop: 26,
    backgroundColor: CORAL,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  saveDisabled: { opacity: 0.4 },
  saveLabel: { fontFamily: SANS_SEMI, fontSize: 15, color: '#FFFFFF' },
  saveHint: { fontFamily: SANS, fontSize: 12, color: MUTE, textAlign: 'center', marginTop: 8 },
  doneLink: { fontFamily: SANS_SEMI, fontSize: 13, color: MUTE },
});
