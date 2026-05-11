import { Avatar, Box, Button, Text } from '@/components';
import { useFollow } from '@/features/follows';
import { useToast } from '@/hooks/use-toast';
import { log } from '@/lib/log';
import * as Contacts from 'expo-contacts';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMatchContacts } from '../api/use-match-contacts';
import { useMatchedFriends } from '../api/use-matched-friends';
import { StepIndicator } from '../components/StepIndicator';

const isWeb = Platform.OS === 'web';

/**
 * Invite (#06 in the design pack). Friends-on-Postmark from your contacts
 * with badges. Tap a row to toggle selection; tap the CTA to follow the
 * selected set in one shot, then advance to welcome.
 *
 * The button copy says "Follow N" rather than "Invite N" because everyone in
 * the list is already on Postmark — the design's "Invite" wording is
 * misleading once you've matched. If we later add not-yet-on-Postmark
 * suggestions to the same list, we'll re-introduce an Invite mode.
 */
export function FriendsScreen() {
  const [permissionTried, setPermissionTried] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const matchContacts = useMatchContacts();
  const matched = useMatchedFriends();
  const follow = useFollow();
  const router = useRouter();
  const toast = useToast();

  useEffect(() => {
    log.event('onboarding.screen_entered', { screen: 'friends' });
  }, []);

  // Pre-select the top 3 highest-ranked matches once the data lands.
  const friends = useMemo(() => matched.data ?? [], [matched.data]);
  useEffect(() => {
    if (friends.length === 0) return;
    if (selected.size > 0) return; // user has interacted
    setSelected(new Set(friends.slice(0, 3).map((f) => f.id)));
  }, [friends, selected.size]);

  const onAllow = async () => {
    setPermissionTried(true);
    const { status } = await Contacts.requestPermissionsAsync();
    if (status !== 'granted') {
      log.event('onboarding.contacts_permission_denied');
      toast.show({ message: 'No contacts shared. You can do this later.', variant: 'info' });
      return;
    }
    log.event('onboarding.contacts_permission_granted');

    const { data } = await Contacts.getContactsAsync({
      fields: [Contacts.Fields.PhoneNumbers],
      pageSize: 5_000,
    });

    const phones = (data ?? [])
      .flatMap((c) => c.phoneNumbers ?? [])
      .map((p) => p.number ?? '')
      .filter((p): p is string => p.length > 0);

    try {
      await matchContacts.mutateAsync({ phoneNumbers: phones });
      await matched.refetch();
    } catch (err) {
      log.error('match-contacts failed', err);
      toast.show({ message: 'Could not match contacts right now.', variant: 'error' });
    }
  };

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const onSkip = () => {
    log.event('onboarding.screen_completed', { screen: 'friends', choice: 'skip' });
    router.replace('/(auth)/welcome');
  };

  const onCommit = async () => {
    if (selected.size === 0) {
      onSkip();
      return;
    }
    try {
      for (const id of selected) {
        await follow.mutateAsync(id);
      }
      log.event('onboarding.screen_completed', {
        screen: 'friends',
        choice: 'follow',
      });
      router.replace('/(auth)/welcome');
    } catch (err) {
      log.error('bulk follow failed', err);
      toast.show({ message: 'Some follows failed. Try again.', variant: 'error' });
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FAF8F3' }}>
      <Box flex={1} padding="l">
        <StepIndicator step={3} total={4} onSkip={onSkip} />

        <Box marginTop="l">
          <Text variant="display" style={{ fontSize: 36, lineHeight: 42 }}>
            Bring your circle.
          </Text>
          <Text
            variant="quote"
            marginTop="s"
            style={{ fontSize: 14, lineHeight: 22, color: '#5A5A5A' }}
          >
            "The smaller the circle, the more honest the recs."
          </Text>
        </Box>

        {isWeb ? (
          <Box marginTop="xl">
            <Text variant="caption" marginBottom="m">
              Contact matching only runs on the iOS / Android app. Skip for now.
            </Text>
            <Button label="Continue" onPress={onSkip} fullWidth size="lg" />
          </Box>
        ) : !permissionTried ? (
          <Box marginTop="xl" gap="m">
            <Button
              label={matchContacts.isPending ? 'Matching…' : 'Match my contacts'}
              variant="accent"
              size="lg"
              fullWidth
              loading={matchContacts.isPending}
              onPress={onAllow}
            />
            <Button label="Skip for now" variant="ghost" size="lg" fullWidth onPress={onSkip} />
          </Box>
        ) : (
          <Box flex={1} marginTop="l">
            <ScrollView style={{ flex: 1 }}>
              {friends.length === 0 ? (
                <Text variant="caption">No one from your contacts yet. Skip for now.</Text>
              ) : (
                friends.map((f) => (
                  <FriendRow
                    key={f.id}
                    name={f.display_name ?? f.handle ?? 'Someone'}
                    badge={f.badge ?? ''}
                    avatarUrl={f.avatar_url}
                    on={selected.has(f.id)}
                    onToggle={() => toggle(f.id)}
                  />
                ))
              )}
            </ScrollView>
            <Box marginTop="l">
              <Button
                label={
                  selected.size === 0
                    ? 'Skip for now'
                    : `Follow ${selected.size} friend${selected.size === 1 ? '' : 's'}`
                }
                onPress={onCommit}
                loading={follow.isPending}
                fullWidth
                size="lg"
              />
            </Box>
          </Box>
        )}
      </Box>
    </SafeAreaView>
  );
}

function FriendRow({
  name,
  badge,
  avatarUrl,
  on,
  onToggle,
}: {
  name: string;
  badge: string;
  avatarUrl: string | null;
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}
      onPress={onToggle}
      hitSlop={{ top: 8, bottom: 8 }}
    >
      <Box
        flexDirection="row"
        alignItems="center"
        gap="m"
        paddingVertical="m"
        style={{ borderBottomWidth: 0.5, borderColor: 'rgba(0,0,0,0.08)' }}
      >
        <Avatar size="md" uri={avatarUrl} fallback={name} />
        <Box flex={1}>
          <Text variant="body" fontFamily="Inter_500Medium">
            {name}
          </Text>
          {badge ? <Text variant="caption">{badge}</Text> : null}
        </Box>
        <View
          style={{
            width: 22,
            height: 22,
            borderRadius: 11,
            borderWidth: 1,
            borderColor: on ? '#1A1A1A' : 'rgba(0,0,0,0.25)',
            backgroundColor: on ? '#1A1A1A' : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {on ? (
            <Text style={{ color: '#FFFFFF', fontSize: 12, fontFamily: 'Inter_500Medium' }}>✓</Text>
          ) : null}
        </View>
      </Box>
    </Pressable>
  );
}
