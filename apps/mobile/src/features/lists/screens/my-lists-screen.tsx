import { Box, Card, Text } from '@/components';
import { useMyLists } from '@/features/lists';
import { photoColor } from '@/theme';
import { Link } from 'expo-router';
import { Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export function MyListsScreen() {
  const q = useMyLists();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FAF8F3' }}>
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 80 }}>
        <Box
          flexDirection="row"
          alignItems="center"
          justifyContent="space-between"
          marginBottom="m"
        >
          <Text variant="title">Your lists</Text>
          <Link href="/list/new" asChild>
            <Pressable>
              <Box
                paddingHorizontal="m"
                paddingVertical="xs"
                borderRadius="pill"
                borderWidth={1}
                borderColor="borderStrong"
              >
                <Text variant="body">+ New</Text>
              </Box>
            </Pressable>
          </Link>
        </Box>

        {q.isLoading ? (
          <Text variant="caption">Loading…</Text>
        ) : (q.data ?? []).length === 0 ? (
          <Box marginTop="m">
            <Text variant="body" color="textMuted">
              No lists yet. Lists are opinions — "Cities I'd live in," "Coffee maps."
            </Text>
          </Box>
        ) : (
          <Box gap="m">
            {(q.data ?? []).map((l) => (
              <Link key={l.id} href={`/list/${l.id}`} asChild>
                <Pressable>
                  <Card>
                    <Box flexDirection="row" gap="m" alignItems="center">
                      <Box
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 6,
                          backgroundColor: l.cover_color ?? photoColor(l.id),
                        }}
                      />
                      <Box flex={1}>
                        <Text variant="placeName" numberOfLines={1}>
                          {l.title}
                        </Text>
                        {l.description ? (
                          <Text variant="quote" numberOfLines={1}>
                            "{l.description}"
                          </Text>
                        ) : null}
                      </Box>
                    </Box>
                  </Card>
                </Pressable>
              </Link>
            ))}
          </Box>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
