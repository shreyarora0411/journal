import { Box, Button, Input, Text, Textarea } from '@/components';
import { useCreateList } from '@/features/lists';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function CreateListScreen() {
  const create = useCreateList();
  const router = useRouter();
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const onSave = async () => {
    if (!title.trim()) {
      toast.show({ message: 'Give it a title.', variant: 'error' });
      return;
    }
    try {
      const list = await create.mutateAsync({ title, description: description || null });
      router.replace(`/list/${list.id}` as never);
    } catch {
      toast.show({ message: 'Could not create list.', variant: 'error' });
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FAF8F3' }}>
      <ScrollView contentContainerStyle={{ padding: 24 }}>
        <Text variant="title" marginBottom="m">
          New list
        </Text>
        <Text variant="caption" marginBottom="l">
          Lists are opinions. Use the first line to tell your friends what they have in common.
        </Text>
        <Box gap="m">
          <Input
            label="Title"
            placeholder="Cities I'd live in"
            value={title}
            onChangeText={setTitle}
            autoFocus
          />
          <Textarea
            label="The pitch"
            placeholder='"Places where I caught myself opening Zillow on the flight home."'
            value={description}
            onChangeText={setDescription}
            minRows={2}
            maxRows={4}
          />
          <Button
            label={create.isPending ? 'Creating…' : 'Create list'}
            loading={create.isPending}
            onPress={onSave}
            fullWidth
            size="lg"
          />
        </Box>
      </ScrollView>
    </SafeAreaView>
  );
}
