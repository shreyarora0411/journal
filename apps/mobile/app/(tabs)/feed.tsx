import { Box, Card, Text } from '@/components';
import { useMyTrips } from '@/features/trips';
import { Link } from 'expo-router';
import { Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function FeedScreen() {
  const trips = useMyTrips();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FAF8F5' }}>
      <ScrollView contentContainerStyle={{ padding: 24 }}>
        <Text variant="title" marginBottom="s">
          Feed
        </Text>
        <Text variant="caption" marginBottom="l">
          Friends' trips arrive in Phase 3. For now: your own.
        </Text>

        {trips.isLoading ? (
          <Text variant="caption">Loading…</Text>
        ) : (trips.data ?? []).length === 0 ? (
          <Box marginTop="l">
            <Text variant="body" color="textMuted">
              No trips yet. Tap{' '}
              <Text variant="body" fontFamily="Inter_500Medium">
                Log
              </Text>{' '}
              below to write your first.
            </Text>
          </Box>
        ) : (
          <Box gap="m">
            {(trips.data ?? []).map((t) => (
              <Link key={t.id} href={`/trip/${t.id}`} asChild>
                <Pressable>
                  <Card>
                    <Text variant="title">{t.title}</Text>
                    {t.start_date ? (
                      <Text variant="caption" marginTop="xs">
                        {t.start_date}
                        {t.end_date && t.end_date !== t.start_date ? ` → ${t.end_date}` : ''}
                      </Text>
                    ) : null}
                    {t.note ? (
                      <Text variant="body" marginTop="s" numberOfLines={3} color="textMuted">
                        {t.note}
                      </Text>
                    ) : null}
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
