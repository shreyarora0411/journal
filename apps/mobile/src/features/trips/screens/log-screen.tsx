import { Page, StatusSpace } from '@/components';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AtomicLogForm } from '../components/AtomicLogForm';
import { TripLogForm } from '../components/TripLogForm';

const INK = '#1A1410';
const MUTE = '#7A716A';
const HAIR = '#EFEAE2';
const PAPER = '#FFFFFF';

type Mode = 'tip' | 'trip';

/**
 * Log screen (Add tab) — dispatcher.
 *
 * Two genuinely different forms behind one toggle:
 *   - Tip: atomic, venue-level recommendation. Category + one-line +
 *     optional prose + verdict. Default. Standalone or attachable to a
 *     trip.
 *   - Trip: a trip's narrative. Title + dates + city + prose.
 *
 * The toggle picks which child component to render. Form state lives
 * inside the children so switching tabs preserves nothing (deliberate —
 * we don't want half-finished trip data leaking into a tip).
 */
export function LogScreen() {
  const [mode, setMode] = useState<Mode>('tip');

  useEffect(() => {
    // No-op effect just to keep linter happy when the component
    // remounts. Real analytics fire inside each child form.
  }, []);

  return (
    <Page>
      <StatusSpace />

      <Text style={styles.headline}>
        {mode === 'tip' ? 'Pop something in the book.' : 'Frame a trip.'}
      </Text>

      <View style={styles.toggleWrap}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Switch to Tip mode"
          accessibilityState={{ selected: mode === 'tip' }}
          onPress={() => setMode('tip')}
          style={[styles.toggleSeg, mode === 'tip' && styles.toggleSegActive]}
        >
          <Text style={[styles.toggleLabel, mode === 'tip' && styles.toggleLabelActive]}>Tip</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Switch to Trip mode"
          accessibilityState={{ selected: mode === 'trip' }}
          onPress={() => setMode('trip')}
          style={[styles.toggleSeg, mode === 'trip' && styles.toggleSegActive]}
        >
          <Text style={[styles.toggleLabel, mode === 'trip' && styles.toggleLabelActive]}>
            Trip
          </Text>
        </Pressable>
      </View>

      <View style={{ marginTop: 18 }}>{mode === 'tip' ? <AtomicLogForm /> : <TripLogForm />}</View>
    </Page>
  );
}

const styles = StyleSheet.create({
  headline: {
    fontFamily: 'InstrumentSerif_400Italic',
    fontSize: 32,
    lineHeight: 36,
    color: INK,
    letterSpacing: -0.8,
    marginTop: 20,
  },
  toggleWrap: {
    flexDirection: 'row',
    backgroundColor: PAPER,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: HAIR,
    padding: 4,
    marginTop: 18,
    alignSelf: 'flex-start',
  },
  toggleSeg: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 999,
  },
  toggleSegActive: {
    backgroundColor: INK,
  },
  toggleLabel: {
    fontFamily: 'Geist_500Medium',
    fontSize: 13,
    color: MUTE,
  },
  toggleLabelActive: {
    color: PAPER,
  },
});
