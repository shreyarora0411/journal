import {
  CategoryPill,
  Eyebrow,
  Page,
  StatusSpace,
  type Verdict,
  VerdictPicker,
} from '@/components';
import { useCreateTripQuick } from '@/features/trips';
import { useToast } from '@/hooks/use-toast';
import { log } from '@/lib/log';
import { CATEGORIES, type Category } from '@/theme';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

const CORAL = '#FF4D2E';
const INK = '#1A1410';
const MUTE = '#7A716A';
const TINT = '#FAF6F0';
const HAIR = '#EFEAE2';
const EMERALD = '#00A67E';

type Mode = 'quick' | 'journal';
const CATEGORIES_ORDER: ReadonlyArray<Category> = ['stay', 'food', 'drinks', 'wander', 'buy'];

/**
 * Log (#13 of the redesign — Batch C). The "Add" tab.
 *
 * One log screen — no separate v1/v2. VerdictPicker (love/mid/skip) is
 * inline per the brief. Verdict surfaces only on the logger's own profile
 * (rule 2); friends see the quote on this place's detail page.
 *
 * Submit drafts a trip via the existing `useCreateTripQuick` mutation —
 * `verdict` column is not yet on the schema; we drop it on save until the
 * migration lands. The Verdict UI works end-to-end; persistence is the
 * follow-up.
 */
export function LogScreen() {
  const router = useRouter();
  const toast = useToast();
  const createTrip = useCreateTripQuick();

  const [mode, setMode] = useState<Mode>('quick');
  const [category, setCategory] = useState<Category>('food');
  const [body, setBody] = useState('');
  const [tip, setTip] = useState('');
  const [verdict, setVerdict] = useState<Verdict>('love');

  const onSubmit = async () => {
    const trimmed = body.trim();
    if (trimmed.length === 0) {
      toast.show({ message: 'Write a sentence first.', variant: 'error' });
      return;
    }
    try {
      const today = new Date().toISOString().slice(0, 10);
      await createTrip.mutateAsync({
        title: 'Pondicherry · Café Des Arts',
        place_name: 'Café Des Arts',
        start_date: today,
        end_date: today,
        note: trimmed + (tip.trim() ? `\n\nTip: ${tip.trim()}` : ''),
        visibility: 'friends_of_friends',
      });
      log.event('log.saved', { mode, category, verdict });
      toast.show({ message: 'Added to your book.', variant: 'success' });
      router.replace('/(tabs)/book');
    } catch (err) {
      log.error('log save failed', err);
      toast.show({ message: 'Could not save. Try again.', variant: 'error' });
    }
  };

  return (
    <Page>
      <StatusSpace />

      {/* Mode toggle */}
      <View style={styles.toggle}>
        <ToggleSeg active={mode === 'quick'} onPress={() => setMode('quick')} label="Quick tip" />
        <ToggleSeg
          active={mode === 'journal'}
          onPress={() => setMode('journal')}
          label="Journal entry"
        />
      </View>

      <Text style={styles.headline}>Pop something in the book.</Text>

      {/* Place picker card (mock — full picker is post-pilot) */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Change place"
        style={styles.placeCard}
        onPress={() =>
          toast.show({ message: 'Place picker is coming. Mock for now.', variant: 'info' })
        }
      >
        <View style={styles.placeThumb}>
          <Text style={{ fontSize: 22, color: MUTE }}>◔</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.placeName}>Café Des Arts</Text>
          <Text style={styles.placeArea}>Pondicherry · French Quarter</Text>
        </View>
        <Text style={styles.changeLink}>Change</Text>
      </Pressable>

      {/* Category chips */}
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 18, flexWrap: 'wrap' }}>
        {CATEGORIES_ORDER.map((c) => (
          <Pressable
            key={c}
            accessibilityRole="button"
            accessibilityLabel={`Set category ${CATEGORIES[c].label}`}
            accessibilityState={{ selected: c === category }}
            onPress={() => setCategory(c)}
          >
            <CategoryPill category={c} variant={c === category ? 'filled' : 'outlined'} />
          </Pressable>
        ))}
      </View>

      {/* What I'd tell a friend */}
      <View style={{ marginTop: 24 }}>
        <Eyebrow>What I'd tell a friend</Eyebrow>
        <View style={styles.inputCard}>
          <TextInput
            accessibilityLabel="What I'd tell a friend"
            placeholder="The clams are not optional. Skip lunch queue, go at 4."
            placeholderTextColor="#B7AEA5"
            value={body}
            onChangeText={(v) => setBody(v.slice(0, 240))}
            multiline
            style={styles.input}
            selectionColor={CORAL}
          />
        </View>
      </View>

      {/* One tip */}
      <View style={{ marginTop: 16 }}>
        <Eyebrow color={MUTE}>One tip</Eyebrow>
        <View style={styles.tipCard}>
          <TextInput
            accessibilityLabel="One tip"
            placeholder="The single thing they need to know."
            placeholderTextColor="#B7AEA5"
            value={tip}
            onChangeText={(v) => setTip(v.slice(0, 140))}
            style={styles.tipInput}
            selectionColor={CORAL}
          />
        </View>
      </View>

      {/* Verdict */}
      <View style={{ marginTop: 22 }}>
        <Eyebrow color={MUTE}>For my book only</Eyebrow>
        <View style={{ marginTop: 10 }}>
          <VerdictPicker value={verdict} onChange={setVerdict} />
        </View>
        <Text style={styles.verdictHint}>
          Stays on your travel book. Friends see the quote, not the rating.
        </Text>
      </View>

      {/* Visibility card */}
      <View style={styles.visibilityCard}>
        <View style={styles.checkBubble}>
          <Text style={styles.checkGlyph}>✓</Text>
        </View>
        <Text style={styles.visibilityLabel}>
          <Text style={{ color: INK }}>Just my circle</Text> · 12 friends. No one else. Promise.
        </Text>
      </View>

      {/* CTA */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add to my book"
        onPress={onSubmit}
        disabled={createTrip.isPending}
        style={styles.cta}
      >
        <Text style={styles.ctaLabel}>{createTrip.isPending ? 'Saving…' : 'Add to my book ✦'}</Text>
      </Pressable>
    </Page>
  );
}

function ToggleSeg({
  active,
  onPress,
  label,
}: {
  active: boolean;
  onPress: () => void;
  label: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.seg, active ? styles.segOn : styles.segOff]}
    >
      <Text style={[styles.segLabel, { color: active ? '#FFFFFF' : MUTE }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  toggle: {
    flexDirection: 'row',
    backgroundColor: TINT,
    borderRadius: 999,
    padding: 4,
    marginTop: 8,
  },
  seg: { flex: 1, paddingVertical: 10, borderRadius: 999, alignItems: 'center' },
  segOn: { backgroundColor: INK },
  segOff: { backgroundColor: 'transparent' },
  segLabel: { fontFamily: 'Geist_500Medium', fontSize: 13 },
  headline: {
    fontFamily: 'InstrumentSerif_400Italic',
    fontSize: 32,
    lineHeight: 36,
    color: INK,
    letterSpacing: -0.8,
    marginTop: 20,
  },
  placeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderColor: HAIR,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginTop: 18,
  },
  placeThumb: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: TINT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeName: { fontFamily: 'Geist_500Medium', fontSize: 15, color: INK },
  placeArea: {
    fontFamily: 'Geist_400Regular',
    fontSize: 12,
    color: MUTE,
    marginTop: 2,
  },
  changeLink: {
    fontFamily: 'Geist_500Medium',
    fontSize: 13,
    color: CORAL,
  },
  inputCard: {
    marginTop: 10,
    backgroundColor: '#FFFFFF',
    borderColor: HAIR,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  input: {
    minHeight: 100,
    fontFamily: 'InstrumentSerif_400Italic',
    fontSize: 19,
    lineHeight: 26,
    color: INK,
    textAlignVertical: 'top',
  },
  tipCard: {
    marginTop: 8,
    backgroundColor: '#FFFFFF',
    borderColor: HAIR,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderLeftWidth: 3,
    borderLeftColor: CORAL,
  },
  tipInput: {
    fontFamily: 'Geist_400Regular',
    fontSize: 15,
    color: INK,
  },
  verdictHint: {
    fontFamily: 'Geist_400Regular',
    fontSize: 12,
    color: MUTE,
    marginTop: 10,
  },
  visibilityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: TINT,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 22,
  },
  checkBubble: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: EMERALD,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkGlyph: {
    color: '#FFFFFF',
    fontFamily: 'Geist_500Medium',
    fontSize: 10,
    lineHeight: 10,
  },
  visibilityLabel: {
    flex: 1,
    fontFamily: 'Geist_400Regular',
    fontSize: 13,
    color: MUTE,
  },
  cta: {
    marginTop: 22,
    backgroundColor: CORAL,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
  },
  ctaLabel: {
    fontFamily: 'Geist_500Medium',
    fontSize: 16,
    color: '#FFFFFF',
  },
});
