import { Box, Button, DetailHeader, Input, Pill, Text, Textarea } from '@/components';
import { useDeleteTrip, useTrip, useUpdateTrip } from '@/features/trips';
import { DateField } from '@/features/trips/components/DateField';
import { useToast } from '@/hooks/use-toast';
import { log } from '@/lib/log';
import type { Visibility } from '@journal/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const visibilityLabel: Record<Visibility, string> = {
  followers: 'Followers',
  friends_of_friends: 'Friends of friends',
  everyone: 'Everyone',
};

export default function EditTripScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tripQ = useTrip(id ?? null);
  const update = useUpdateTrip();
  const del = useDeleteTrip();
  const router = useRouter();
  const toast = useToast();

  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [note, setNote] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('friends_of_friends');
  const [hydrated, setHydrated] = useState(false);

  // Hydrate the form from the trip once it loads.
  useEffect(() => {
    if (hydrated || !tripQ.data) return;
    setTitle(tripQ.data.title);
    setStartDate(tripQ.data.start_date ?? '');
    setEndDate(tripQ.data.end_date ?? '');
    setNote(tripQ.data.note ?? '');
    setVisibility(tripQ.data.visibility);
    setHydrated(true);
  }, [tripQ.data, hydrated]);

  const onSave = async () => {
    if (!id) return;
    if (!title.trim()) {
      toast.show({ message: 'Give it a title.', variant: 'error' });
      return;
    }
    try {
      await update.mutateAsync({
        id,
        patch: {
          title: title.trim(),
          start_date: startDate || null,
          end_date: endDate || null,
          note: note.trim() || null,
          visibility,
        },
      });
      log.event('trip.edit_saved');
      toast.show({ message: 'Saved.', variant: 'success' });
      router.back();
    } catch (err) {
      log.error('trip update failed', err);
      toast.show({ message: 'Could not save.', variant: 'error' });
    }
  };

  const onDelete = () => {
    if (!id) return;
    const proceed = async () => {
      try {
        await del.mutateAsync(id);
        toast.show({ message: 'Trip deleted.', variant: 'success' });
        router.replace('/(tabs)/book' as never);
      } catch (err) {
        log.error('trip delete failed', err);
        toast.show({ message: 'Could not delete.', variant: 'error' });
      }
    };
    if (Platform.OS === 'web') {
      if (
        typeof window !== 'undefined' &&
        window.confirm('Delete this trip? This cannot be undone.')
      )
        proceed();
    } else {
      Alert.alert('Delete this trip?', 'This cannot be undone.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: proceed },
      ]);
    }
  };

  const choices = useMemo(
    () => ['followers', 'friends_of_friends', 'everyone'] as Visibility[],
    [],
  );

  if (tripQ.isLoading || !hydrated) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
        <DetailHeader title="Edit" />
        <Box flex={1} padding="xl">
          <Text variant="caption">Loading…</Text>
        </Box>
      </SafeAreaView>
    );
  }

  if (!tripQ.data) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
        <DetailHeader title="Edit" />
        <Box flex={1} padding="xl">
          <Text variant="title" marginBottom="m">
            Not found
          </Text>
        </Box>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <DetailHeader title="Edit trip" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 80 }}>
          <Box gap="l">
            <Input
              label="Title"
              placeholder="Five days in Pokhara"
              value={title}
              onChangeText={setTitle}
              autoCapitalize="sentences"
            />
            <Box flexDirection="row" gap="m">
              <Box flex={1}>
                <DateField
                  label="Start"
                  placeholder="Pick"
                  value={startDate}
                  onChange={setStartDate}
                />
              </Box>
              <Box flex={1}>
                <DateField label="End" placeholder="Pick" value={endDate} onChange={setEndDate} />
              </Box>
            </Box>
            <Textarea
              label="Note"
              placeholder="What you'd tell a friend…"
              value={note}
              onChangeText={setNote}
              minRows={4}
              maxRows={12}
            />
            <Box>
              <Text variant="label" marginBottom="s">
                PRIVACY
              </Text>
              <Box flexDirection="row" gap="s" flexWrap="wrap">
                {choices.map((v) => (
                  <Pill
                    key={v}
                    label={visibilityLabel[v]}
                    variant={visibility === v ? 'on' : 'default'}
                    onPress={() => setVisibility(v)}
                  />
                ))}
              </Box>
            </Box>

            <Button
              label={update.isPending ? 'Saving…' : 'Save changes'}
              onPress={onSave}
              loading={update.isPending}
              fullWidth
              size="lg"
            />
            <Button label="Delete trip" variant="ghost" onPress={onDelete} fullWidth />
          </Box>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
