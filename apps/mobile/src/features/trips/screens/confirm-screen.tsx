import { Box, Button, Card, Input, Pill, Text } from '@/components';
import { useConfirmEntity, useExtractedEntities, useRejectEntity, useTrip } from '@/features/trips';
import { useToast } from '@/hooks/use-toast';
import { log } from '@/lib/log';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ConfirmScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tripQ = useTrip(id ?? null);
  const entitiesQ = useExtractedEntities(id ?? null);
  const confirm = useConfirmEntity();
  const reject = useRejectEntity();
  const router = useRouter();
  const toast = useToast();
  const [edits, setEdits] = useState<Record<string, { name: string; quote: string }>>({});

  if (tripQ.isLoading || entitiesQ.isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FAF8F3' }}>
        <Box flex={1} padding="xl">
          <Text variant="caption">Loading…</Text>
        </Box>
      </SafeAreaView>
    );
  }

  if (!tripQ.data) return null;

  const trip = tripQ.data;
  const placeId = trip.places[0]?.id;
  const pending = (entitiesQ.data ?? []).filter((e) => !e.confirmed && !e.rejected);

  const onConfirm = async (entityId: string) => {
    if (!placeId) {
      toast.show({ message: 'Add a place first.', variant: 'error' });
      return;
    }
    const edit = edits[entityId];
    try {
      await confirm.mutateAsync({
        entityId,
        tripId: trip.id,
        placeId,
        override: edit ? { name: edit.name, quote: edit.quote || null } : undefined,
      });
      log.event('extraction.entity_confirmed');
    } catch (err) {
      log.error('confirm entity failed', err);
      toast.show({ message: 'Could not confirm.', variant: 'error' });
    }
  };

  const onReject = async (entityId: string) => {
    try {
      await reject.mutateAsync({ entityId, tripId: trip.id });
      log.event('extraction.entity_rejected');
    } catch (err) {
      log.error('reject entity failed', err);
    }
  };

  const onConfirmAll = async () => {
    for (const e of pending) {
      // eslint-disable-next-line no-await-in-loop -- intentional sequential to keep RLS-friendly load
      await onConfirm(e.id);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FAF8F3' }}>
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 80 }}>
        <Text variant="title" marginBottom="s">
          Looks like
        </Text>
        <Text variant="caption" marginBottom="l">
          Tap each one to keep it. Edit names or quotes if anything’s off.
        </Text>

        {pending.length === 0 ? (
          <Box marginBottom="l">
            <Text variant="caption">
              {entitiesQ.data && entitiesQ.data.length > 0
                ? 'All caught up.'
                : 'No entities yet — give the extraction a few seconds, or your note may be too short.'}
            </Text>
            <Box marginTop="l">
              <Button
                label="Back to trip"
                variant="ghost"
                onPress={() => router.replace(`/trip/${id}`)}
              />
            </Box>
          </Box>
        ) : (
          <Box gap="m">
            {pending.map((e) => {
              const edit = edits[e.id];
              const name = edit?.name ?? e.proposed_name;
              const quote = edit?.quote ?? e.proposed_quote ?? '';
              const meta = e.proposed_metadata as { kind?: string; tip_kind?: string };
              return (
                <Card key={e.id}>
                  <Box flexDirection="row" gap="s" marginBottom="s" alignItems="center">
                    <Pill label={e.kind} variant="accent" />
                    {meta.kind ? <Pill label={meta.kind} /> : null}
                    {meta.tip_kind ? <Pill label={meta.tip_kind} /> : null}
                  </Box>
                  <Box gap="s">
                    <Input
                      label="Name"
                      value={name}
                      onChangeText={(v) => setEdits((s) => ({ ...s, [e.id]: { name: v, quote } }))}
                    />
                    <Input
                      label="Quote"
                      value={quote}
                      onChangeText={(v) => setEdits((s) => ({ ...s, [e.id]: { name, quote: v } }))}
                    />
                  </Box>
                  <Box flexDirection="row" gap="s" marginTop="m">
                    <Button label="Keep" onPress={() => onConfirm(e.id)} />
                    <Button label="Reject" variant="ghost" onPress={() => onReject(e.id)} />
                  </Box>
                </Card>
              );
            })}
            <Button label="Looks good — keep all" onPress={onConfirmAll} fullWidth size="lg" />
          </Box>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
