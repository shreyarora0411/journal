import { Box, DetailHeader, Pill, Text } from '@/components';
import { useState } from 'react';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { type MapDestination, useMapData } from '../api/use-map-data';

type Filter = 'visited' | 'wishlist';

/**
 * v0 "map" — list-shaped atlas, not a literal map. The brief's screen 16
 * shows visited (filled dots) + wishlist (outline). For pilot on web we
 * skip react-native-maps and render the same data as two grouped lists.
 * Real geographic map lands when we drop the Expo Go constraint.
 */
export default function MapScreen() {
  const q = useMapData();
  const [filter, setFilter] = useState<Filter>('visited');

  const rows = (q.data ?? []).filter((r) => r.status === filter);
  const visitedCount = (q.data ?? []).filter((r) => r.status === 'visited').length;
  const wishlistCount = (q.data ?? []).filter((r) => r.status === 'wishlist').length;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <DetailHeader title="Your map" />
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 80 }}>
        <Text variant="title" marginBottom="m">
          Your map
        </Text>
        <Box flexDirection="row" gap="s" marginBottom="l">
          <Pill
            label={`Visited · ${visitedCount}`}
            variant={filter === 'visited' ? 'on' : 'default'}
            onPress={() => setFilter('visited')}
          />
          <Pill
            label={`Wishlist · ${wishlistCount}`}
            variant={filter === 'wishlist' ? 'on' : 'default'}
            onPress={() => setFilter('wishlist')}
          />
        </Box>

        {q.isLoading ? (
          <Text variant="caption">Loading…</Text>
        ) : rows.length === 0 ? (
          <Text variant="caption">
            {filter === 'visited'
              ? 'Add a trip and it shows up here.'
              : "Tap any place to save it. We'll keep it for the trip you haven't booked yet."}
          </Text>
        ) : (
          <Box gap="m">
            {rows.map((r) => (
              <MapRow key={`${r.status}-${r.name}-${r.country ?? ''}`} row={r} />
            ))}
          </Box>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function MapRow({ row }: { row: MapDestination }) {
  return (
    <Box
      flexDirection="row"
      alignItems="center"
      gap="m"
      paddingVertical="s"
      style={{ borderBottomWidth: 0.5, borderColor: 'rgba(0,0,0,0.08)' }}
    >
      <Box
        style={{
          width: 10,
          height: 10,
          borderRadius: 5,
          backgroundColor: row.status === 'visited' ? '#FF4D2E' : 'transparent',
          borderWidth: row.status === 'wishlist' ? 1.4 : 0,
          borderColor: '#5F5E5A',
        }}
      />
      <Box flex={1}>
        <Text variant="placeName">{row.name}</Text>
        <Text variant="meta">
          {row.country ? `${row.country}` : ''}
          {row.country && row.saved_from ? ' · ' : ''}
          {row.saved_from ? `From ${row.saved_from}` : ''}
        </Text>
      </Box>
      {row.trip_count > 1 ? <Text variant="meta">{row.trip_count} trips</Text> : null}
    </Box>
  );
}
