import { Avatar, Box, Button, Card, Pill, Text } from '@/components';
import { useAuthStore, useProfile, useSignOut } from '@/features/auth';
import { useFollowCounts } from '@/features/follows';
import { Link } from 'expo-router';
import { Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUserTrips } from '../api/use-user-trips';

export function ProfileScreen() {
  const profileQ = useProfile();
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  const counts = useFollowCounts(userId);
  const trips = useUserTrips(userId);
  const signOut = useSignOut();

  const profile = profileQ.data;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FAF8F5' }}>
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 80 }}>
        <Box flexDirection="row" alignItems="center" gap="m" marginBottom="l">
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

        <Box flexDirection="row" gap="m" marginBottom="l">
          <Pill label={`${trips.data?.length ?? 0} trips`} />
          <Pill label={`${counts.data?.followers ?? 0} followers`} />
          <Pill label={`${counts.data?.following ?? 0} following`} />
        </Box>

        <Text variant="label" marginBottom="s">
          TRIPS
        </Text>
        {(trips.data ?? []).length === 0 ? (
          <Text variant="caption">No trips yet.</Text>
        ) : (
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
          </Box>
        )}

        <Box marginTop="xl">
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
