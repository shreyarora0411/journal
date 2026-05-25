import { Box, Button, Card, DetailHeader, Input, Text } from '@/components';
import { useAuthStore } from '@/features/auth';
import {
  useAddListItem,
  useFindOrCreateDestination,
  useList,
  useListItems,
} from '@/features/lists';
import { useToast } from '@/hooks/use-toast';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ListDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const listQ = useList(id ?? null);
  const itemsQ = useListItems(id ?? null);
  const addItem = useAddListItem();
  const findOrCreate = useFindOrCreateDestination();
  const router = useRouter();
  const toast = useToast();
  const meId = useAuthStore((s) => s.session?.user.id ?? null);
  const [newDest, setNewDest] = useState('');
  const [newCountry, setNewCountry] = useState('');
  const [newNote, setNewNote] = useState('');

  if (listQ.isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
        <DetailHeader />
        <Box flex={1} padding="xl">
          <Text variant="caption">Loading…</Text>
        </Box>
      </SafeAreaView>
    );
  }
  if (!listQ.data) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
        <DetailHeader />
        <Box flex={1} padding="xl">
          <Text variant="title" marginBottom="m">
            List not found
          </Text>
          <Button label="Back" variant="ghost" onPress={() => router.back()} />
        </Box>
      </SafeAreaView>
    );
  }

  const list = listQ.data;
  const isMine = meId === list.owner_id;

  const onAdd = async () => {
    if (!newDest.trim()) {
      toast.show({ message: 'Add a destination name.', variant: 'error' });
      return;
    }
    if (!id) return;
    try {
      const destinationId = await findOrCreate.mutateAsync({
        name: newDest,
        country: newCountry || null,
      });
      await addItem.mutateAsync({
        listId: id,
        destination_id: destinationId,
        note: newNote || null,
      });
      setNewDest('');
      setNewCountry('');
      setNewNote('');
      toast.show({ message: 'Added.', variant: 'success' });
    } catch {
      toast.show({ message: 'Could not add.', variant: 'error' });
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <DetailHeader title={list.title} />
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 80 }}>
        <Text variant="label">A LIST BY YOU</Text>
        <Text variant="display" marginTop="xs">
          {list.title}
        </Text>
        {list.description ? (
          <Text variant="quote" marginTop="s">
            "{list.description}"
          </Text>
        ) : null}
        <Text variant="meta" marginTop="m">
          {(itemsQ.data ?? []).length} cities
        </Text>

        <Box marginTop="l" gap="m">
          {(itemsQ.data ?? []).map((it, idx) => (
            <Card key={it.id}>
              <Box flexDirection="row" gap="m" alignItems="flex-start">
                <Text variant="placeName" color="textHint" style={{ width: 24 }}>
                  {String(idx + 1).padStart(2, '0')}
                </Text>
                <Box flex={1}>
                  <Text variant="placeName">{it.destination_name ?? it.city_name ?? '—'}</Text>
                  {it.destination_country ? (
                    <Text variant="meta">{it.destination_country}</Text>
                  ) : null}
                  {it.note ? (
                    <Text variant="quote" marginTop="xs">
                      "{it.note}"
                    </Text>
                  ) : null}
                </Box>
              </Box>
            </Card>
          ))}
        </Box>

        {isMine ? (
          <Box marginTop="xl" gap="m">
            <Text variant="label">ADD A CITY</Text>
            <Input label="City" placeholder="Lisbon" value={newDest} onChangeText={setNewDest} />
            <Input
              label="Country"
              placeholder="Portugal"
              value={newCountry}
              onChangeText={setNewCountry}
            />
            <Input
              label="Why this one"
              placeholder='"The light, the trams, the rent."'
              value={newNote}
              onChangeText={setNewNote}
            />
            <Button
              label={addItem.isPending || findOrCreate.isPending ? 'Adding…' : 'Add'}
              loading={addItem.isPending || findOrCreate.isPending}
              onPress={onAdd}
            />
          </Box>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
