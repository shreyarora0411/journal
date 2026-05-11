import { Box, Button, Card, Pill, Text } from '@/components';
import { useCreateTripQuick } from '@/features/trips';
import { useToast } from '@/hooks/use-toast';
import { log } from '@/lib/log';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLoadCameraRoll } from '../api/use-load-photos';
import type { ProposedTrip } from '../lib/cluster';

const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmt = (ms: number) => {
  const d = new Date(ms);
  return `${d.getDate()} ${MONTH[d.getMonth()]} ${d.getFullYear()}`;
};

/**
 * Camera-roll import. Replaces Instagram OAuth for the pilot — see ADR 0005.
 * Sequence:
 *   1. Tap "Read my photos" → permission prompt → expo-media-library scan
 *   2. Cluster into proposed trips (gap > 36h)
 *   3. User selects which clusters to save → one trip per cluster
 */
export default function ImportScreen() {
  const load = useLoadCameraRoll();
  const createTrip = useCreateTripQuick();
  const router = useRouter();
  const toast = useToast();
  const [proposed, setProposed] = useState<ProposedTrip[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const isWeb = Platform.OS === 'web';

  useEffect(() => {
    log.event('import.screen_entered');
  }, []);

  const onScan = async () => {
    try {
      const result = await load.mutateAsync();
      if (!result.supported) {
        toast.show({ message: 'Camera roll only works on iOS / Android.', variant: 'info' });
        return;
      }
      setProposed(result.proposed);
      setSelected(new Set(result.proposed.map((p) => p.id)));
    } catch (err) {
      log.error('camera roll scan failed', err);
      toast.show({ message: 'Could not read photos.', variant: 'error' });
    }
  };

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const onSave = async () => {
    const chosen = proposed.filter((p) => selected.has(p.id));
    if (chosen.length === 0) {
      toast.show({ message: 'Pick at least one trip.', variant: 'error' });
      return;
    }
    for (const p of chosen) {
      try {
        const startISO = new Date(p.startMs).toISOString().slice(0, 10);
        const endISO = new Date(p.endMs).toISOString().slice(0, 10);
        await createTrip.mutateAsync({
          title: p.suggestedTitle,
          place_name: p.suggestedTitle,
          start_date: startISO,
          end_date: endISO,
          note: undefined,
          visibility: 'friends_of_friends',
        });
      } catch (err) {
        log.error('import trip create failed', err);
      }
    }
    toast.show({
      message: `Drafted ${chosen.length} trip${chosen.length === 1 ? '' : 's'}. They'll appear in your Book.`,
      variant: 'success',
    });
    // Stay in the onboarding flow — drafts will be visible on Book once
    // the user finishes Friends/Welcome and lands on the tabs.
    router.replace('/(auth)/friends' as never);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FAF8F3' }}>
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 80 }}>
        <Text variant="title" marginBottom="s">
          Already a traveller?
        </Text>
        <Text variant="caption" marginBottom="l">
          We'll cluster your last six months of photos into trip drafts. Nothing leaves your phone
          until you save.
        </Text>

        {isWeb ? (
          <Text variant="caption" marginTop="m">
            Camera roll import only works in the iOS / Android app.
          </Text>
        ) : proposed.length === 0 ? (
          <Button
            label={load.isPending ? 'Reading photos…' : 'Read my photos'}
            variant="accent"
            loading={load.isPending}
            onPress={onScan}
            fullWidth
            size="lg"
          />
        ) : (
          <>
            <Text variant="label" marginBottom="s">
              {selected.size} OF {proposed.length} TRIPS SELECTED
            </Text>
            <Box gap="m">
              {proposed.map((p) => {
                const on = selected.has(p.id);
                return (
                  <Card key={p.id}>
                    <Box flexDirection="row" alignItems="center" gap="m">
                      <Pill
                        label={on ? '✓' : ' '}
                        variant={on ? 'on' : 'default'}
                        onPress={() => toggle(p.id)}
                      />
                      <Box flex={1}>
                        <Text variant="placeName">{p.suggestedTitle}</Text>
                        <Text variant="meta">
                          {fmt(p.startMs)} → {fmt(p.endMs)} · {p.photos.length} photos
                        </Text>
                      </Box>
                    </Box>
                  </Card>
                );
              })}
            </Box>
            <Box marginTop="l" gap="s">
              <Button
                label={
                  createTrip.isPending
                    ? 'Saving…'
                    : `Draft ${selected.size} trip${selected.size === 1 ? '' : 's'}`
                }
                onPress={onSave}
                loading={createTrip.isPending}
                fullWidth
                size="lg"
              />
              <Button label="Cancel" variant="ghost" onPress={() => router.back()} />
            </Box>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
