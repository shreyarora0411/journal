import { Avatar, Box, Button, Card, DetailHeader, Pill, Text } from '@/components';
import { useSaveToWishlist } from '@/features/wishlist';
import { useToast } from '@/hooks/use-toast';
import { photoColor } from '@/theme';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCanonicalPlace } from '../api/use-canonical-place';

export default function PlaceDetailScreen() {
  const { name: nameParam, country: countryParam } = useLocalSearchParams<{
    name: string;
    country?: string;
  }>();
  const name = typeof nameParam === 'string' ? decodeURIComponent(nameParam) : null;
  const country = typeof countryParam === 'string' ? decodeURIComponent(countryParam) : null;
  const q = useCanonicalPlace(name, country);
  const save = useSaveToWishlist();
  const router = useRouter();
  const toast = useToast();

  const onSave = async () => {
    if (!name) return;
    const firstSighting = q.data?.sightings[0];
    try {
      await save.mutateAsync({
        place_id: firstSighting?.place_id ?? null,
        saved_from_trip_id: firstSighting?.trip_id ?? null,
        saved_from_user_id: firstSighting?.user_id ?? null,
        note: null,
      });
      toast.show({ message: 'Saved to your next trip.', variant: 'success' });
    } catch {
      toast.show({ message: 'Could not save.', variant: 'error' });
    }
  };

  if (q.isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FAF8F3' }}>
        <DetailHeader />
        <Box flex={1} padding="xl">
          <Text variant="caption">Loading…</Text>
        </Box>
      </SafeAreaView>
    );
  }

  const sightings = q.data?.sightings ?? [];
  const display = q.data?.canonical?.display_name ?? name ?? '';
  const headerColor = photoColor(display);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FAF8F3' }}>
      <DetailHeader title={display} />
      <ScrollView contentContainerStyle={{ paddingBottom: 80 }}>
        <Box style={{ height: 150, backgroundColor: headerColor }} />
        <Box padding="l">
          <Text variant="title">{display}</Text>
          {country ? (
            <Text variant="meta" marginTop="xs">
              {country}
            </Text>
          ) : null}

          {sightings.length === 0 ? (
            <Box marginTop="l">
              <Text variant="caption">
                No friends have saved this place yet. You could be the first.
              </Text>
            </Box>
          ) : (
            <>
              <Box marginTop="m">
                <Pill
                  label={`${sightings.length} ${sightings.length === 1 ? 'friend' : 'friends'} saved`}
                  variant="accent"
                />
              </Box>
              <Box marginTop="l" gap="m">
                {sightings.map((s) => (
                  <Card key={s.place_id}>
                    <Box flexDirection="row" gap="m" alignItems="flex-start">
                      <Avatar
                        size="sm"
                        uri={s.user?.avatar_url ?? null}
                        fallback={s.user?.display_name ?? s.user?.handle ?? '?'}
                      />
                      <Box flex={1}>
                        <Text variant="body" fontFamily="Inter_500Medium">
                          {s.user?.display_name ?? s.user?.handle ?? 'Someone'}
                        </Text>
                        {s.quote ? (
                          <Text variant="quote" marginTop="xs">
                            "{s.quote}"
                          </Text>
                        ) : null}
                        <Link href={`/trip/${s.trip_id}`} asChild>
                          <Pressable>
                            <Text variant="meta" marginTop="s">
                              From their {s.trip_title} →
                            </Text>
                          </Pressable>
                        </Link>
                      </Box>
                    </Box>
                  </Card>
                ))}
              </Box>
            </>
          )}

          <Box marginTop="xl" gap="s">
            <Button
              label={save.isPending ? 'Saving…' : 'Save to my next trip'}
              variant="accent"
              loading={save.isPending}
              onPress={onSave}
              fullWidth
              size="lg"
            />
            <Button label="Back" variant="ghost" onPress={() => router.back()} />
          </Box>
        </Box>
      </ScrollView>
    </SafeAreaView>
  );
}
