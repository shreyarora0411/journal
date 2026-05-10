import { Avatar, Box, Button, Card, Pill, Text } from '@/components';
import { useAuthStore } from '@/features/auth';
import { useFollow, useFollowCounts, useFollowStatus, useUnfollow } from '@/features/follows';
import { Link, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUserByHandle } from '../api/use-user-by-handle';
import { useUserPlaces, useUserStays, useUserTips, useUserTrips } from '../api/use-user-trips';

type Tab = 'trips' | 'stays' | 'places' | 'tips';

const tabs: { id: Tab; label: string }[] = [
  { id: 'trips', label: 'Trips' },
  { id: 'stays', label: 'Stays' },
  { id: 'places', label: 'Places' },
  { id: 'tips', label: 'Tips' },
];

export default function FriendProfileScreen() {
  const { handle } = useLocalSearchParams<{ handle: string }>();
  const userQ = useUserByHandle(handle);
  const meId = useAuthStore((s) => s.session?.user.id ?? null);
  const otherId = userQ.data?.id ?? null;
  const isMe = meId != null && otherId != null && meId === otherId;

  const counts = useFollowCounts(otherId);
  const followStatus = useFollowStatus(otherId);
  const follow = useFollow();
  const unfollow = useUnfollow();

  const [tab, setTab] = useState<Tab>('trips');
  const trips = useUserTrips(otherId);
  const stays = useUserStays(otherId);
  const places = useUserPlaces(otherId);
  const tips = useUserTips(otherId);

  if (userQ.isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FAF8F5' }}>
        <Box flex={1} padding="xl">
          <Text variant="caption">Loading…</Text>
        </Box>
      </SafeAreaView>
    );
  }

  if (!userQ.data) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FAF8F5' }}>
        <Box flex={1} padding="xl">
          <Text variant="title" marginBottom="m">
            Not found
          </Text>
        </Box>
      </SafeAreaView>
    );
  }

  const u = userQ.data;
  const onToggleFollow = () => {
    if (!otherId) return;
    if (followStatus.data) unfollow.mutate(otherId);
    else follow.mutate(otherId);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FAF8F5' }}>
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 80 }}>
        <Box flexDirection="row" alignItems="center" gap="m" marginBottom="m">
          <Avatar size="lg" uri={u.avatar_url} fallback={u.display_name ?? u.handle ?? '?'} />
          <Box flex={1}>
            <Text variant="title">{u.display_name ?? '—'}</Text>
            {u.handle ? <Text variant="caption">@{u.handle}</Text> : null}
          </Box>
        </Box>

        <Box flexDirection="row" gap="m" marginBottom="l">
          <Pill label={`${trips.data?.length ?? 0} trips`} />
          <Pill label={`${counts.data?.followers ?? 0} followers`} />
          <Pill label={`${counts.data?.following ?? 0} following`} />
        </Box>

        {!isMe ? (
          <Box marginBottom="l">
            <Button
              label={followStatus.data ? 'Following' : 'Follow'}
              variant={followStatus.data ? 'ghost' : 'primary'}
              loading={follow.isPending || unfollow.isPending}
              onPress={onToggleFollow}
            />
          </Box>
        ) : null}

        <Box flexDirection="row" gap="s" marginBottom="l" flexWrap="wrap">
          {tabs.map((t) => (
            <Pill
              key={t.id}
              label={t.label}
              variant={tab === t.id ? 'on' : 'default'}
              onPress={() => setTab(t.id)}
            />
          ))}
        </Box>

        {tab === 'trips' ? (
          <Box gap="s">
            {(trips.data ?? []).map((t) => (
              <Link key={t.id} href={`/trip/${t.id}`} asChild>
                <Pressable>
                  <Card>
                    <Text variant="body" fontFamily="Inter_500Medium">
                      {t.title}
                    </Text>
                    {t.start_date ? (
                      <Text variant="caption" marginTop="xs">
                        {t.start_date}
                        {t.end_date && t.end_date !== t.start_date ? ` → ${t.end_date}` : ''}
                      </Text>
                    ) : null}
                  </Card>
                </Pressable>
              </Link>
            ))}
            {(trips.data ?? []).length === 0 ? (
              <Text variant="caption">No trips visible to you.</Text>
            ) : null}
          </Box>
        ) : null}

        {tab === 'stays' ? (
          <Box gap="s">
            {(stays.data ?? []).map((r) => (
              <Link key={r.id} href={`/trip/${r.trip_id}`} asChild>
                <Pressable>
                  <Card>
                    <Text variant="body" fontFamily="Inter_500Medium">
                      {r.name}
                    </Text>
                    {r.quote ? (
                      <Text variant="quote" marginTop="xs" numberOfLines={2}>
                        “{r.quote}”
                      </Text>
                    ) : null}
                    <Text variant="caption" marginTop="xs">
                      from {r.trip_title}
                    </Text>
                  </Card>
                </Pressable>
              </Link>
            ))}
            {(stays.data ?? []).length === 0 ? <Text variant="caption">No stays.</Text> : null}
          </Box>
        ) : null}

        {tab === 'places' ? (
          <Box gap="s">
            {(places.data ?? []).map((r) => (
              <Link key={r.id} href={`/trip/${r.trip_id}`} asChild>
                <Pressable>
                  <Card>
                    <Text variant="body" fontFamily="Inter_500Medium">
                      {r.name}
                    </Text>
                    <Text variant="caption" marginTop="xs">
                      from {r.trip_title}
                    </Text>
                  </Card>
                </Pressable>
              </Link>
            ))}
            {(places.data ?? []).length === 0 ? <Text variant="caption">No places.</Text> : null}
          </Box>
        ) : null}

        {tab === 'tips' ? (
          <Box gap="s">
            {(tips.data ?? []).map((r) => (
              <Link key={r.id} href={`/trip/${r.trip_id}`} asChild>
                <Pressable>
                  <Card>
                    <Text variant="body">{r.name}</Text>
                    <Text variant="caption" marginTop="xs">
                      from {r.trip_title}
                    </Text>
                  </Card>
                </Pressable>
              </Link>
            ))}
            {(tips.data ?? []).length === 0 ? <Text variant="caption">No tips.</Text> : null}
          </Box>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
