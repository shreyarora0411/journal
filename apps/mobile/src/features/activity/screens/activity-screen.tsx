import { Avatar, Box, Text } from '@/components';
import { Link } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { type ActivityEvent, useActivity } from '../api/use-activity';

const bucketLabel = (b: ActivityEvent['bucket']): string => {
  if (b === 'today') return 'TODAY';
  if (b === 'yesterday') return 'YESTERDAY';
  if (b === 'this_week') return 'THIS WEEK';
  return 'EARLIER';
};

const verbLine = (e: ActivityEvent) => {
  if (e.kind === 'trip_added') return 'got back from';
  if (e.kind === 'follow_started') return 'started following';
  if (e.kind === 'list_created') return 'started a list';
  return 'added';
};

export function ActivityScreen() {
  const q = useActivity();

  const groups = useMemo(() => {
    const out: Record<ActivityEvent['bucket'], ActivityEvent[]> = {
      today: [],
      yesterday: [],
      this_week: [],
      earlier: [],
    };
    for (const e of q.data ?? []) out[e.bucket].push(e);
    return out;
  }, [q.data]);

  const buckets: ActivityEvent['bucket'][] = ['today', 'yesterday', 'this_week', 'earlier'];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 80 }}>
        <Text variant="headline" marginBottom="m">
          Activity
        </Text>

        {q.isLoading ? (
          <Text variant="caption">Loading…</Text>
        ) : (q.data ?? []).length === 0 ? (
          <Box marginTop="m">
            <Text variant="body" color="textMuted">
              Nothing yet. When friends add trips or follow people, it'll show up here.
            </Text>
            <Link href={'/(tabs)/friends' as never} asChild>
              <Pressable>
                <Text variant="caption" marginTop="m" style={{ color: '#FF4D2E' }}>
                  Invite someone →
                </Text>
              </Pressable>
            </Link>
          </Box>
        ) : (
          buckets.map((b) =>
            groups[b].length === 0 ? null : (
              <Box key={b} marginBottom="l">
                <Text variant="label" marginBottom="s">
                  {bucketLabel(b)}
                </Text>
                <Box gap="m">
                  {groups[b].map((e) => (
                    <Link key={e.id} href={e.href as never} asChild>
                      <Pressable>
                        <Box flexDirection="row" alignItems="flex-start" gap="m">
                          <Avatar
                            size="sm"
                            uri={e.user.avatar_url}
                            fallback={e.user.display_name ?? e.user.handle ?? '?'}
                          />
                          <Box flex={1} minWidth={0}>
                            <Text variant="body">
                              <Text variant="body" fontFamily="Inter_500Medium">
                                {e.user.display_name ?? e.user.handle ?? 'Someone'}
                              </Text>{' '}
                              {verbLine(e)} <Text variant="placeName">{e.subject}</Text>
                            </Text>
                            {e.snippet ? (
                              <Text variant="quote" marginTop="xs" numberOfLines={2}>
                                “{e.snippet}”
                              </Text>
                            ) : null}
                          </Box>
                        </Box>
                      </Pressable>
                    </Link>
                  ))}
                </Box>
              </Box>
            ),
          )
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
