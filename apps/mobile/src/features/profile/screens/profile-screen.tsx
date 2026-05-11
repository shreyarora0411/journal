import { Avatar, Box, Button, Card, Pill, Text } from '@/components';
import { useAuthStore, useProfile, useSignOut } from '@/features/auth';
import { useFollowCounts } from '@/features/follows';
import { InviteButton } from '@/features/invite';
import { useMyLists } from '@/features/lists';
import { photoColor } from '@/theme';
import { Link, useRouter } from 'expo-router';
import { Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFavouriteFour, useSetFavouriteFour } from '../api/use-favourite-four';
import { useUserTrips } from '../api/use-user-trips';

export function ProfileScreen() {
  const profileQ = useProfile();
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  const counts = useFollowCounts(userId);
  const trips = useUserTrips(userId);
  const lists = useMyLists();
  const favourites = useFavouriteFour(userId);
  const setFavourites = useSetFavouriteFour();
  const signOut = useSignOut();
  const router = useRouter();

  const profile = profileQ.data;
  const myTrips = trips.data ?? [];
  const favList = favourites.data ?? [];
  const favIds = new Set(favList.map((t) => t.id));
  const canPin = favList.length < 4;

  const onPin = async (tripId: string) => {
    const next = [...favList.map((t) => t.id), tripId].slice(0, 4);
    await setFavourites.mutateAsync(next);
  };

  const onUnpin = async (tripId: string) => {
    const next = favList.filter((t) => t.id !== tripId).map((t) => t.id);
    await setFavourites.mutateAsync(next);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FAF8F3' }}>
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 80 }}>
        <Box flexDirection="row" alignItems="center" gap="m" marginBottom="m">
          <Avatar
            size="lg"
            uri={profile?.avatar_url ?? null}
            fallback={profile?.display_name ?? 'You'}
          />
          <Box flex={1}>
            <Text variant="title">{profile?.display_name ?? 'You'}</Text>
            {profile?.handle ? <Text variant="caption">@{profile.handle}</Text> : null}
          </Box>
        </Box>

        <Box
          flexDirection="row"
          gap="m"
          marginBottom="l"
          paddingVertical="s"
          style={{ borderTopWidth: 0.5, borderBottomWidth: 0.5, borderColor: 'rgba(0,0,0,0.08)' }}
        >
          <Box flex={1}>
            <Text variant="title">{myTrips.length}</Text>
            <Text variant="meta">trips</Text>
          </Box>
          <Box flex={1}>
            <Text variant="title">{counts.data?.followers ?? 0}</Text>
            <Text variant="meta">followers</Text>
          </Box>
          <Box flex={1}>
            <Text variant="title">{counts.data?.following ?? 0}</Text>
            <Text variant="meta">following</Text>
          </Box>
        </Box>

        <Text variant="label" marginBottom="s">
          FAVOURITE FOUR
        </Text>
        <Box flexDirection="row" flexWrap="wrap" marginBottom="l" style={{ gap: 8 }}>
          {[0, 1, 2, 3].map((slot) => {
            const t = favList[slot];
            if (t) {
              return (
                <Pressable
                  key={slot}
                  onLongPress={() => onUnpin(t.id)}
                  onPress={() => router.push(`/trip/${t.id}` as never)}
                  style={{ width: '48%' }}
                >
                  <Box>
                    <Box
                      style={{
                        width: '100%',
                        height: 84,
                        borderRadius: 6,
                        backgroundColor: photoColor(t.id),
                      }}
                    />
                    <Text variant="placeName" marginTop="xs" numberOfLines={1}>
                      {t.title}
                    </Text>
                  </Box>
                </Pressable>
              );
            }
            return (
              <Box
                key={slot}
                style={{
                  width: '48%',
                  height: 84,
                  borderRadius: 6,
                  borderWidth: 1,
                  borderStyle: 'dashed',
                  borderColor: '#9A9A9A',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Text variant="meta">empty</Text>
              </Box>
            );
          })}
        </Box>
        {canPin && myTrips.length > 0 ? (
          <Box marginBottom="l">
            <Text variant="caption" marginBottom="s">
              Pick anchor trips. Tap to add — long-press a pinned one to remove.
            </Text>
            <Box flexDirection="row" flexWrap="wrap" style={{ gap: 8 }}>
              {myTrips
                .filter((t) => !favIds.has(t.id))
                .slice(0, 8)
                .map((t) => (
                  <Pill key={t.id} label={t.title} onPress={() => onPin(t.id)} />
                ))}
            </Box>
          </Box>
        ) : null}

        <Box
          flexDirection="row"
          alignItems="center"
          justifyContent="space-between"
          marginBottom="s"
        >
          <Text variant="label">LISTS</Text>
          <Link href="/list/new" asChild>
            <Pressable>
              <Text variant="meta">+ New</Text>
            </Pressable>
          </Link>
        </Box>
        {(lists.data ?? []).length === 0 ? (
          <Text variant="caption" marginBottom="l">
            No lists yet. Lists are opinions — "Cities I'd live in," "Coffee maps."
          </Text>
        ) : (
          <Box gap="s" marginBottom="l">
            {(lists.data ?? []).slice(0, 5).map((l) => (
              <Link key={l.id} href={`/list/${l.id}`} asChild>
                <Pressable>
                  <Box
                    flexDirection="row"
                    alignItems="center"
                    justifyContent="space-between"
                    paddingVertical="s"
                    style={{ borderBottomWidth: 0.5, borderColor: 'rgba(0,0,0,0.08)' }}
                  >
                    <Text variant="placeName">{l.title}</Text>
                    <Text variant="meta">›</Text>
                  </Box>
                </Pressable>
              </Link>
            ))}
          </Box>
        )}

        <Box
          flexDirection="row"
          alignItems="center"
          justifyContent="space-between"
          marginBottom="s"
        >
          <Text variant="label">YOUR MAP</Text>
          <Link href={'/map' as never} asChild>
            <Pressable>
              <Text variant="meta">View →</Text>
            </Pressable>
          </Link>
        </Box>
        <Box marginBottom="l">
          <Link href={'/year-in-travel' as never} asChild>
            <Pressable>
              <Card>
                <Text variant="placeName">Your 2026 in travel</Text>
                <Text variant="caption" marginTop="xs">
                  Trips, cities, distance, taste twin.
                </Text>
              </Card>
            </Pressable>
          </Link>
        </Box>

        <Box marginTop="m" gap="m">
          <InviteButton />
          <Button
            label={signOut.isPending ? 'Signing out…' : 'Sign out'}
            variant="ghost"
            loading={signOut.isPending}
            onPress={() => signOut.mutate()}
          />
        </Box>
      </ScrollView>
    </SafeAreaView>
  );
}
