import { Avatar, Box, Card, Pill, Text } from '@/components';
import { useProfile } from '@/features/auth';
import { type FeedRow, useFeed } from '@/features/feed';
import { useMyTrips } from '@/features/trips';
import { SignedPhoto } from '@/features/trips/components/SignedPhoto';
import { Link } from 'expo-router';
import { useMemo } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TripSpine } from '../components/TripSpine';

const formatTimeAgo = (iso: string): string => {
  const diffMs = Date.now() - new Date(iso).getTime();
  const day = 24 * 60 * 60 * 1000;
  if (diffMs < 60 * 60 * 1000) return `${Math.max(1, Math.round(diffMs / 60000))}m`;
  if (diffMs < day) return `${Math.round(diffMs / (60 * 60 * 1000))}h`;
  if (diffMs < 7 * day) return `${Math.round(diffMs / day)}d`;
  if (diffMs < 365 * day) return `${Math.round(diffMs / (7 * day))}w`;
  return `${Math.round(diffMs / (365 * day))}y`;
};

/**
 * Book — home tab.
 *
 * Per Postmark brief screen 09:
 *   - Top: greeting + "Your travel book" subhead
 *   - Strip: horizontal scroll of YOUR trips (TripSpine)
 *   - Feed: friend activity below (FeedRow cards)
 */
export function BookScreen() {
  const profile = useProfile();
  const myTrips = useMyTrips();
  const feed = useFeed();
  const myUserId = profile.data?.id ?? null;

  // Exclude my own trips from the feed (they show in the strip above).
  const friendRows = useMemo(
    () => (feed.data?.pages ?? []).flatMap((p) => p.rows).filter((r) => r.user_id !== myUserId),
    [feed.data?.pages, myUserId],
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FAF8F3' }}>
      <FlatList
        contentContainerStyle={{ padding: 24, paddingBottom: 80 }}
        data={friendRows}
        keyExtractor={(r) => r.id}
        ItemSeparatorComponent={() => <Box height={16} />}
        ListHeaderComponent={
          <View>
            <Box
              flexDirection="row"
              alignItems="flex-start"
              justifyContent="space-between"
              marginBottom="m"
            >
              <Box>
                <Text variant="meta">Hi, {profile.data?.display_name ?? 'there'}</Text>
                <Text variant="headline" marginTop="xs">
                  Your travel book
                </Text>
              </Box>
              <Avatar
                size="md"
                uri={profile.data?.avatar_url ?? null}
                fallback={profile.data?.display_name ?? '?'}
              />
            </Box>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginBottom: 24 }}
            >
              <Box flexDirection="row" gap="m" paddingRight="m">
                {(myTrips.data ?? []).map((t) => (
                  <TripSpine
                    key={t.id}
                    tripId={t.id}
                    title={t.title}
                    startDate={t.start_date}
                    coverPath={null}
                  />
                ))}
                <Link href="/add" asChild>
                  <Pressable>
                    <Box width={64}>
                      <Box
                        style={{
                          width: 64,
                          height: 80,
                          borderRadius: 6,
                          borderWidth: 1,
                          borderStyle: 'dashed',
                          borderColor: '#9A9A9A',
                          justifyContent: 'center',
                          alignItems: 'center',
                        }}
                      >
                        <Text variant="meta">+ add</Text>
                      </Box>
                      <Text variant="placeName" color="textHint" marginTop="xs">
                        Next
                      </Text>
                    </Box>
                  </Pressable>
                </Link>
              </Box>
            </ScrollView>

            <Box flexDirection="row" justifyContent="space-between" marginBottom="s">
              <Text variant="label">FROM YOUR FRIENDS</Text>
            </Box>
          </View>
        }
        ListEmptyComponent={
          feed.isLoading ? (
            <Text variant="caption">Loading…</Text>
          ) : (
            <Box marginTop="l">
              <Text variant="body" color="textMuted" marginBottom="m">
                Your friends' trips will show up here.
              </Text>
              <Text variant="caption">
                Follow friends, or log a trip of your own — your trips appear in the strip above.
              </Text>
            </Box>
          )
        }
        renderItem={({ item }) => <BookFeedCard row={item} />}
        refreshControl={
          <RefreshControl
            refreshing={feed.isRefetching}
            onRefresh={() => {
              feed.refetch();
              myTrips.refetch();
            }}
          />
        }
        onEndReached={() => {
          if (feed.hasNextPage && !feed.isFetchingNextPage) feed.fetchNextPage();
        }}
        onEndReachedThreshold={0.5}
      />
    </SafeAreaView>
  );
}

function BookFeedCard({ row }: { row: FeedRow }) {
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
              <Text variant="meta" numberOfLines={1}>
                {row.author?.handle ? `@${row.author.handle} · ` : ''}
                {formatTimeAgo(row.created_at)}
              </Text>
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
