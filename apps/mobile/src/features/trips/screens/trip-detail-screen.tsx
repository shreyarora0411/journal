import { Box, Button, Card, DetailHeader, Pill, Text } from '@/components';
import { useAuthStore } from '@/features/auth';
import { useTrip } from '@/features/trips';
import type { VenueKind } from '@journal/shared';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PhotoUploader } from '../components/PhotoUploader';
import { SignedPhoto } from '../components/SignedPhoto';

const placeHref = (name: string, country?: string | null) => {
  const c = country ? `?country=${encodeURIComponent(country)}` : '';
  return `/place/${encodeURIComponent(name)}${c}` as never;
};

const venueGroupTitle: Record<VenueKind, string> = {
  stay: 'Stays',
  restaurant: 'Eat',
  cafe: 'Cafés',
  nightlife: 'Nightlife',
  other: 'Other',
};

const formatDateRange = (start?: string | null, end?: string | null) => {
  if (!start && !end) return null;
  if (start && end && start !== end) return `${start} → ${end}`;
  return start ?? end ?? null;
};

export default function TripDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tripQ = useTrip(id ?? null);
  const router = useRouter();
  const myUserId = useAuthStore((s) => s.session?.user.id ?? null);

  if (tripQ.isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FAF8F3' }}>
        <DetailHeader />
        <Box flex={1} padding="xl">
          <Text variant="caption">Loading…</Text>
        </Box>
      </SafeAreaView>
    );
  }

  if (!tripQ.data) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FAF8F3' }}>
        <DetailHeader />
        <Box flex={1} padding="xl">
          <Text variant="title" marginBottom="m">
            Not found
          </Text>
          <Button label="Back" variant="ghost" onPress={() => router.back()} />
        </Box>
      </SafeAreaView>
    );
  }

  const trip = tripQ.data;
  const isMine = trip.user_id === myUserId;
  const dateRange = formatDateRange(trip.start_date, trip.end_date);
  const cover = trip.photos.find((p) => p.id === trip.cover_photo_id) ?? trip.photos[0];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FAF8F3' }}>
      <DetailHeader
        title={trip.title}
        right={
          isMine ? (
            <Link href={`/trip/${trip.id}/edit` as never} asChild>
              <Pressable hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Text variant="body" fontFamily="Inter_500Medium">
                  Edit
                </Text>
              </Pressable>
            </Link>
          ) : null
        }
      />
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 80 }}>
        {cover ? (
          <Box marginBottom="l">
            <SignedPhoto
              storagePath={cover.storage_path}
              aspect={(cover.width ?? 4) / (cover.height ?? 3)}
              maxWidth={320}
              accessibilityLabel={trip.title}
            />
          </Box>
        ) : null}

        <Text variant="title" marginBottom="xs">
          {trip.title}
        </Text>
        {dateRange ? (
          <Text variant="caption" marginBottom="s">
            {dateRange}
          </Text>
        ) : null}

        <Box flexDirection="row" gap="s" marginBottom="l">
          <Pill label={trip.visibility.replace(/_/g, ' ')} variant="accent" />
          {trip.imported_from ? <Pill label={`from ${trip.imported_from}`} /> : null}
        </Box>

        {trip.note ? (
          <Box marginBottom="l">
            <Text variant="body">{trip.note}</Text>
          </Box>
        ) : null}

        {trip.places.map((place) => {
          const venueGroups: { kind: VenueKind; items: typeof place.venues }[] = [];
          for (const v of place.venues) {
            const existing = venueGroups.find((g) => g.kind === v.kind);
            if (existing) existing.items.push(v);
            else venueGroups.push({ kind: v.kind, items: [v] });
          }

          return (
            <Box key={place.id} marginBottom="xl">
              <Text variant="title" marginBottom="xs">
                {place.name}
              </Text>
              {place.country ? (
                <Text variant="caption" marginBottom="s">
                  {place.region ? `${place.region}, ` : ''}
                  {place.country}
                </Text>
              ) : null}
              {place.note ? (
                <Text variant="body" marginBottom="m">
                  {place.note}
                </Text>
              ) : null}

              {place.areas.length > 0 ? (
                <Box marginBottom="m">
                  <Text variant="label" marginBottom="s">
                    AREAS
                  </Text>
                  <Box gap="s">
                    {place.areas.map((a) => (
                      <Link key={a.id} href={placeHref(a.name, place.country)} asChild>
                        <Pressable>
                          <Card>
                            <Box
                              flexDirection="row"
                              justifyContent="space-between"
                              alignItems="center"
                            >
                              <Box flex={1}>
                                <Text variant="body" fontFamily="Inter_500Medium">
                                  {a.name}
                                </Text>
                                {a.quote ? (
                                  <Text variant="quote" marginTop="xs">
                                    “{a.quote}”
                                  </Text>
                                ) : null}
                              </Box>
                              <Text variant="meta" marginLeft="s">
                                ›
                              </Text>
                            </Box>
                          </Card>
                        </Pressable>
                      </Link>
                    ))}
                  </Box>
                </Box>
              ) : null}

              {venueGroups.map((group) => (
                <Box key={group.kind} marginBottom="m">
                  <Text variant="label" marginBottom="s">
                    {venueGroupTitle[group.kind].toUpperCase()}
                  </Text>
                  <Box gap="s">
                    {group.items.map((v) => (
                      <Link key={v.id} href={placeHref(v.name, place.country)} asChild>
                        <Pressable>
                          <Card>
                            <Box
                              flexDirection="row"
                              justifyContent="space-between"
                              alignItems="center"
                            >
                              <Box flex={1}>
                                <Text variant="body" fontFamily="Inter_500Medium">
                                  {v.name}
                                </Text>
                                {v.quote ? (
                                  <Text variant="quote" marginTop="xs">
                                    “{v.quote}”
                                  </Text>
                                ) : null}
                              </Box>
                              <Text variant="meta" marginLeft="s">
                                ›
                              </Text>
                            </Box>
                          </Card>
                        </Pressable>
                      </Link>
                    ))}
                  </Box>
                </Box>
              ))}
            </Box>
          );
        })}

        {trip.trip_tips.length > 0 ? (
          <Box marginBottom="l">
            <Text variant="label" marginBottom="s">
              TIPS
            </Text>
            <Box gap="s">
              {trip.trip_tips.map((t) => (
                <Card key={t.id}>
                  <Text variant="body">{t.body}</Text>
                </Card>
              ))}
            </Box>
          </Box>
        ) : null}

        {isMine ? (
          <Box gap="m" marginTop="l">
            <PhotoUploader tripId={trip.id} existingCount={trip.photos.length} />
            <Link href={`/trip/${trip.id}/confirm`} asChild>
              <Button label="Review extracted entities" variant="ghost" />
            </Link>
          </Box>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
