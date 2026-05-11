import { Box, Card, Input, Pill, Text } from '@/components';
import { type SearchKind, type SearchResult, useSearch } from '@/features/search';
import { Link } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Filter = 'all' | SearchKind;

const filters: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'venue', label: 'Venues' },
  { id: 'area', label: 'Areas' },
  { id: 'place', label: 'Places' },
  { id: 'tip', label: 'Tips' },
];

const kindLabel: Record<SearchKind, string> = {
  place: 'Place',
  venue: 'Venue',
  area: 'Area',
  tip: 'Tip',
};

export function SearchScreen() {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const results = useSearch(q);

  const filtered = useMemo(() => {
    const rows = results.data ?? [];
    if (filter === 'all') return rows;
    return rows.filter((r) => r.kind === filter);
  }, [results.data, filter]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FAF8F3' }}>
      <Box padding="l" paddingBottom="none">
        <Text variant="title" marginBottom="m">
          Search
        </Text>
        <Input
          placeholder="Pokhara, ramen, Lakeside…"
          value={q}
          onChangeText={setQ}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Box flexDirection="row" gap="s" marginTop="m" flexWrap="wrap">
          {filters.map((f) => (
            <Pill
              key={f.id}
              label={f.label}
              variant={filter === f.id ? 'on' : 'default'}
              onPress={() => setFilter(f.id)}
            />
          ))}
        </Box>
      </Box>

      <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 16 }}>
        {q.trim().length < 2 ? (
          <Text variant="caption" marginTop="l">
            Type a place. Your friends have probably been.
          </Text>
        ) : results.isLoading ? (
          <Text variant="caption" marginTop="l">
            Searching…
          </Text>
        ) : filtered.length === 0 ? (
          <Text variant="caption" marginTop="l">
            No matches in your friend graph yet.
          </Text>
        ) : (
          <Box gap="m">
            {filtered.map((r) => (
              <SearchResultRow key={`${r.kind}-${r.id}`} result={r} />
            ))}
          </Box>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function SearchResultRow({ result }: { result: SearchResult }) {
  return (
    <Link href={`/trip/${result.trip_id}`} asChild>
      <Pressable>
        <Card>
          <Box flexDirection="row" alignItems="center" gap="s" marginBottom="xs">
            <Pill label={kindLabel[result.kind]} variant="accent" />
            <Text variant="caption" numberOfLines={1}>
              from {result.trip_title}
            </Text>
          </Box>
          <Text variant="body" fontFamily="Inter_500Medium">
            {result.name}
          </Text>
          {result.quote ? (
            <Text variant="quote" marginTop="xs" numberOfLines={3}>
              “{result.quote}”
            </Text>
          ) : null}
        </Card>
      </Pressable>
    </Link>
  );
}
