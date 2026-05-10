import { Avatar, Box, Card, Pill, Text } from '@/components';
import { type FeedRow, useFeed } from '@/features/feed';
import { SignedPhoto } from '@/features/trips/components/SignedPhoto';
import { Link } from 'expo-router';
import { useMemo } from 'react';
import { FlatList, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const formatTimeAgo = (iso: string): string => {
  const diffMs = Date.now() - new Date(iso).getTime();
  const day = 24 * 60 * 60 * 1000;
  if (diffMs < 60 * 60 * 1000) return `${Math.max(1, Math.round(diffMs / 60000))}m`;
  if (diffMs < day) return `${Math.round(diffMs / (60 * 60 * 1000))}h`;
  if (diffMs < 7 * day) return `${Math.round(diffMs / day)}d`;
  if (diffMs < 365 * day) return `${Math.round(diffMs / (7 * day))}w`;
  return `${Math.round(diffMs / (365 * day))}y`;
};

export function FeedScreen() {
  const feed = useFeed();
  const rows = useMemo(() => (feed.data?.pages ?? []).flatMap((p) => p.rows), [feed.data?.pages]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FAF8F5' }}>
      <FlatList
        contentContainerStyle={{ padding: 24, paddingBottom: 80 }}
        data={rows}
        keyExtractor={(r) => r.id}
        ItemSeparatorComponent={() => <Box height={16} />}
        ListHeaderComponent={
          <Box marginBottom="l">
            <Text variant="title">Feed</Text>
          </Box>
        }
        ListEmptyComponent={
          feed.isLoading ? (
            <Text variant="caption">Loading…</Text>
          ) : (
            <Box>
              <Text variant="body" color="textMuted" marginBottom="m">
                Nothing in your feed yet.
              </Text>
              <Text variant="caption">
                Follow friends, or log a trip of your own — your trips appear here too.
              </Text>
            </Box>
          )
        }
        renderItem={({ item }) => <FeedCard row={item} />}
        refreshControl={
          <RefreshControl refreshing={feed.isRefetching} onRefresh={() => feed.refetch()} />
        }
        onEndReached={() => {
          if (feed.hasNextPage && !feed.isFetchingNextPage) feed.fetchNextPage();
        }}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          feed.isFetchingNextPage ? (
            <Box paddingVertical="l">
              <Text variant="caption">Loading more…</Text>
            </Box>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

function FeedCard({ row }: { row: FeedRow }) {
  const authorName = row.author?.display_name ?? row.author?.handle ?? 'Someone';

  return (
    <Link href={`/trip/${row.id}`} asChild>
      <Pressable>
        <Card>
          <Box flexDirection="row" alignItems="center" gap="s" marginBottom="s">
            <Avatar size="sm" uri={row.author?.avatar_url ?? null} fallback={authorName} />
            <Box flex={1}>
              <Text variant="body" fontFamily="Inter_500Medium" numberOfLines={1}>
                {authorName}
              </Text>
              {row.author?.handle ? (
                <Text variant="caption" numberOfLines={1}>
                  @{row.author.handle} · {formatTimeAgo(row.created_at)}
                </Text>
              ) : (
                <Text variant="caption">{formatTimeAgo(row.created_at)}</Text>
              )}
            </Box>
            <Pill label={row.visibility.replace(/_/g, ' ')} />
          </Box>

          {row.cover_photo_path ? (
            <Box marginBottom="s" alignItems="flex-start">
              <SignedPhoto
                storagePath={row.cover_photo_path}
                aspect={4 / 3}
                maxWidth={220}
                accessibilityLabel={row.title}
              />
            </Box>
          ) : null}

          <Text variant="title" marginBottom="xs">
            {row.title}
          </Text>
          {row.note ? (
            <Text variant="body" color="textMuted" numberOfLines={3}>
              {row.note}
            </Text>
          ) : null}
        </Card>
      </Pressable>
    </Link>
  );
}
