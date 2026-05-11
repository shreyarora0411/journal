import { Avatar, Box, Button, Card, Text } from '@/components';
import { useToast } from '@/hooks/use-toast';
import { log } from '@/lib/log';
import * as Contacts from 'expo-contacts';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMatchContacts } from '../api/use-match-contacts';
import { useMatchedFriends } from '../api/use-matched-friends';

const isWeb = Platform.OS === 'web';

export function FriendsScreen() {
  const [permissionTried, setPermissionTried] = useState(false);
  const matchContacts = useMatchContacts();
  const matched = useMatchedFriends();
  const router = useRouter();
  const toast = useToast();

  useEffect(() => {
    log.event('onboarding.screen_entered', { screen: 'friends' });
  }, []);

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

  const onContinue = () => {
    log.event('onboarding.screen_completed', { screen: 'friends' });
    router.replace('/(auth)/welcome');
  };

  const friends = matched.data ?? [];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FAF8F3' }}>
      <Box flex={1} padding="xl">
        <Text variant="title" marginBottom="s">
          Find your people
        </Text>
        <Text variant="body" color="textMuted" marginBottom="xl">
          {isWeb
            ? 'Contact matching only runs on the iOS / Android app. Skip for now.'
            : 'Match your contacts privately. We hash phone numbers before they leave your device.'}
        </Text>

        {isWeb ? (
          <Button label="Skip" variant="ghost" size="lg" fullWidth onPress={onContinue} />
        ) : !permissionTried || (matchContacts.isPending && friends.length === 0) ? (
          <Box gap="m">
            <Button
              label={matchContacts.isPending ? 'Matching…' : 'Match my contacts'}
              variant="accent"
              size="lg"
              fullWidth
              loading={matchContacts.isPending}
              onPress={onAllow}
            />
            <Button label="Skip" variant="ghost" size="lg" fullWidth onPress={onContinue} />
          </Box>
        ) : (
          <Box flex={1}>
            <Text variant="label" marginBottom="s">
              {friends.length === 0 ? 'NO ONE FROM YOUR CONTACTS YET' : 'ALREADY ON POSTMARK'}
            </Text>
            <ScrollView style={{ flex: 1 }}>
              <Box gap="s">
                {friends.map((f) => (
                  <Card key={f.id}>
                    <Box flexDirection="row" alignItems="center" gap="m">
                      <Avatar size="md" uri={f.avatar_url} fallback={f.display_name ?? '?'} />
                      <Box flex={1}>
                        <Text variant="body">{f.display_name ?? 'Someone'}</Text>
                        {f.badge ? (
                          <Text variant="caption">{f.badge}</Text>
                        ) : f.handle ? (
                          <Text variant="caption">@{f.handle}</Text>
                        ) : null}
                      </Box>
                    </Box>
                  </Card>
                ))}
              </Box>
            </ScrollView>
            <Box marginTop="l">
              <Button label="Continue" onPress={onContinue} fullWidth size="lg" />
            </Box>
          </Box>
        )}
      </Box>
    </SafeAreaView>
  );
}
