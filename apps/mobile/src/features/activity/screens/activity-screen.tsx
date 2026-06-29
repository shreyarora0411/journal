import { Avatar, Box, Text } from '@/components';
import { useAuthStore } from '@/features/auth';
import { buildPersonalInviteText } from '@/features/invite';
import { Link, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Linking, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { type ActivityEvent, useActivity } from '../api/use-activity';

const inviteViaWhatsApp = async (text: string) => {
  const url = `whatsapp://send?text=${encodeURIComponent(text)}`;
  const can = await Linking.canOpenURL(url).catch(() => false);
  if (can) {
    await Linking.openURL(url);
    return;
  }
  // Fallback to the share-only universal URL when WhatsApp isn't installed.
  await Linking.openURL(`https://wa.me/?text=${encodeURIComponent(text)}`).catch(() => null);
};

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
  const router = useRouter();
  const viewerId = useAuthStore((s) => s.session?.user.id ?? null);

  // Personal invite carries ?id=<me> so installed friends / QR scans land
  // already following the inviter. Falls back to link-free copy when signed out.
  const inviteText = useMemo(() => buildPersonalInviteText(viewerId), [viewerId]);

  // Re-enter the build-your-circle flow post-onboarding (contact matching lives
  // there). `reentry=1` tells the screen not to re-stamp onboarding.
  const goFindFriends = () => router.push('/(auth)/circle?reentry=1');

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
        <Box
          flexDirection="row"
          alignItems="center"
          justifyContent="space-between"
          marginBottom="m"
        >
          <Text variant="headline">Activity</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Find friends"
            onPress={goFindFriends}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text variant="caption" style={{ color: '#FF4D2E' }}>
              Find friends →
            </Text>
          </Pressable>
        </Box>

        {q.isLoading ? (
          <Text variant="caption">Loading…</Text>
        ) : (q.data ?? []).length === 0 ? (
          <Box marginTop="m">
            <Text variant="body" color="textMuted">
              Nothing yet. When friends add trips or follow people, it'll show up here.
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Build your circle"
              onPress={goFindFriends}
            >
              <Text variant="caption" marginTop="m" style={{ color: '#FF4D2E' }}>
                Build your circle →
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Invite a friend via WhatsApp"
              onPress={() => inviteViaWhatsApp(inviteText)}
            >
              <Text variant="caption" marginTop="s" style={{ color: '#FF4D2E' }}>
                Invite a friend →
              </Text>
            </Pressable>
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
