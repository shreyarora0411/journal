import { Avatar, Box, Button, Card, Input, PhotoFrame, Pill, Text, Textarea } from '@/components';
import { useToast } from '@/hooks/use-toast';
import { Stack } from 'expo-router';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const SAMPLE_PHOTO = 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=600';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box marginBottom="xl">
      <Text variant="label" marginBottom="s">
        {title.toUpperCase()}
      </Text>
      <Box gap="m">{children}</Box>
    </Box>
  );
}

export default function DevComponents() {
  const toast = useToast();

  if (!__DEV__) return null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FAF8F3' }}>
      <Stack.Screen options={{ title: 'Components', headerShown: true }} />
      <ScrollView contentContainerStyle={{ padding: 24 }}>
        <Text variant="title" marginBottom="m">
          Design system
        </Text>
        <Text variant="caption" marginBottom="xl">
          Phase 0 QA surface. Every primitive, every variant.
        </Text>

        <Section title="Text variants">
          <Text variant="title">Title — Fraunces medium</Text>
          <Text variant="body">Body — Inter regular, sets the rhythm.</Text>
          <Text variant="caption">Caption — secondary, smaller.</Text>
          <Text variant="quote">"Friend voice — Fraunces italic."</Text>
          <Text variant="label">LABEL — UPPERCASE TRACKED</Text>
        </Section>

        <Section title="Buttons">
          <Button label="Primary" onPress={() => toast.show({ message: 'Primary pressed' })} />
          <Button
            label="Ghost"
            variant="ghost"
            onPress={() => toast.show({ message: 'Ghost pressed' })}
          />
          <Button
            label="Accent"
            variant="accent"
            onPress={() => toast.show({ message: 'Accent pressed', variant: 'success' })}
          />
          <Button label="Loading" loading />
          <Button label="Disabled" disabled />
          <Button label="Small" size="sm" />
          <Button label="Large" size="lg" />
          <Button label="Full width" fullWidth />
        </Section>

        <Section title="Inputs">
          <Input label="Handle" placeholder="@shrey" />
          <Input label="With error" placeholder="…" error="That handle is taken." />
          <Textarea
            label="Trip note"
            placeholder="Five days in Pokhara — woke up to the lake every morning…"
          />
        </Section>

        <Section title="Avatars">
          <Box flexDirection="row" alignItems="center" gap="m">
            <Avatar size="xs" fallback="SA" />
            <Avatar size="sm" fallback="Shrey Arora" />
            <Avatar size="md" fallback="Divyansh K" />
            <Avatar size="lg" fallback="N" />
          </Box>
        </Section>

        <Section title="Pills">
          <Box flexDirection="row" flexWrap="wrap" gap="s">
            <Pill label="All" variant="on" />
            <Pill label="Stays" />
            <Pill label="Eat" />
            <Pill label="Areas" />
            <Pill label="Tips" variant="accent" />
          </Box>
        </Section>

        <Section title="Card">
          <Card>
            <Text variant="title">Five days in Pokhara</Text>
            <Text variant="caption" marginBottom="s">
              March 2026 · Nepal
            </Text>
            <Text variant="body">
              Woke up to the lake every morning. Slow mornings, long walks, paragliding once.
            </Text>
          </Card>
        </Section>

        <Section title="Photo frame">
          <Box flexDirection="row" gap="m">
            <PhotoFrame
              uri={SAMPLE_PHOTO}
              aspect={4 / 5}
              maxWidth={140}
              accessibilityLabel="lake"
            />
            <PhotoFrame
              uri={SAMPLE_PHOTO}
              aspect={3 / 2}
              maxWidth={200}
              accessibilityLabel="lake landscape"
            />
          </Box>
        </Section>

        <Section title="Toast">
          <Button
            label="Info toast"
            variant="ghost"
            onPress={() => toast.show({ message: 'Saved.', variant: 'info' })}
          />
          <Button
            label="Success toast"
            variant="ghost"
            onPress={() => toast.show({ message: 'Trip saved.', variant: 'success' })}
          />
          <Button
            label="Error toast"
            variant="ghost"
            onPress={() =>
              toast.show({ message: 'Could not reach the network.', variant: 'error' })
            }
          />
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}
