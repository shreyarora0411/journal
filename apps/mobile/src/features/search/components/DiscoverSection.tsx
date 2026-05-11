import { Avatar, Box, Card, Pill, Text } from '@/components';
import { useFollow } from '@/features/follows';
import { Link } from 'expo-router';
import { Pressable } from 'react-native';
import { useDiscover } from '../api/use-discover';

/**
 * Discover lives inside Search (Postmark brief §6). Tier 2 of the discovery
 * hierarchy: friends-of-friends. Shown only when the user has FoF candidates;
 * stays silent otherwise.
 */
export function DiscoverSection() {
  const q = useDiscover();
  const follow = useFollow();

  if (q.isLoading || (q.data ?? []).length === 0) return null;

  return (
    <Box marginTop="xl">
      <Text variant="label" marginBottom="s">
        THROUGH YOUR FRIENDS
      </Text>
      <Box gap="m">
        {(q.data ?? []).slice(0, 5).map((u) => (
          <Card key={u.id}>
            <Box flexDirection="row" gap="m" alignItems="center">
              <Avatar size="sm" uri={u.avatar_url} fallback={u.display_name ?? u.handle ?? '?'} />
              <Box flex={1}>
                <Link href={u.handle ? (`/friend/${u.handle}` as never) : '/'} asChild>
                  <Pressable>
                    <Text variant="body" fontFamily="Inter_500Medium">
                      {u.display_name ?? u.handle}
                    </Text>
                  </Pressable>
                </Link>
                <Text variant="meta">
                  {u.via ? `${u.via} · ` : ''}
                  {u.trip_count} trip{u.trip_count === 1 ? '' : 's'}
                </Text>
                {u.bio ? (
                  <Text variant="quote" numberOfLines={1} marginTop="xs">
                    “{u.bio}”
                  </Text>
                ) : null}
              </Box>
              <Pill label="Follow" onPress={() => follow.mutate(u.id)} />
            </Box>
          </Card>
        ))}
      </Box>
    </Box>
  );
}
