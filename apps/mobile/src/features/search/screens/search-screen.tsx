import { EntityCard, Eyebrow, Page, StatusSpace } from '@/components';
import { useSearch } from '@/features/search';
import { log } from '@/lib/log';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

const CORAL = '#FF4D2E';
const INK = '#1A1410';
const MUTE = '#7A716A';
const TINT = '#FAF6F0';
const HAIR = '#EFEAE2';

/**
 * Search — real results only.
 *
 * Calls `search_friend_graph` via useSearch (debounced). Three states:
 *   1. Empty query → quiet "Search anything" copy
 *   2. Loaded with 0 rows → quiet "Nothing in your circle yet"
 *   3. Loaded with rows → list grouped by kind (countries → cities →
 *      venues → areas → tips)
 *
 * The fake "Friends I trust" destination list with the HOT badges was
 * removed in the delete-dummy-data session. It came from fixtures.
 */
export function SearchScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const q = useSearch(query);

  useEffect(() => {
    log.event('search.screen_entered');
  }, []);

  const results = q.data ?? [];
  const trimmed = query.trim();
  const showEmptyState = trimmed.length < 2;
  const showNoResults = !showEmptyState && !q.isLoading && results.length === 0;

  const onRowPress = (r: (typeof results)[number]) => {
    if (r.trip_id) {
      router.push(`/trip/${r.trip_id}` as never);
    }
  };

  return (
    <Page>
      <StatusSpace />
      <Text style={styles.headline}>Where are you going?</Text>

      <View style={styles.searchPill}>
        <Text style={styles.searchGlyph}>⌕</Text>
        <TextInput
          accessibilityLabel="Search destinations"
          placeholder="A city, a place, a friend's name…"
          placeholderTextColor="#B7AEA5"
          value={query}
          onChangeText={setQuery}
          style={styles.searchInput}
          selectionColor={CORAL}
        />
      </View>

      {showEmptyState ? (
        <Text style={styles.hint}>
          Search a city or a venue. Vouches from your circle show up here as it grows.
        </Text>
      ) : showNoResults ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Nothing in your circle yet.</Text>
          <Text style={styles.emptyBody}>
            No one in your network has vouched for "{trimmed}" yet.
          </Text>
        </View>
      ) : q.isLoading ? (
        <Text style={styles.hint}>Searching…</Text>
      ) : (
        <View style={{ marginTop: 18 }}>
          <Eyebrow>
            {results.length} result{results.length === 1 ? '' : 's'}
          </Eyebrow>
          <View style={{ gap: 8, marginTop: 12 }}>
            {results.map((r) => {
              const area = [r.kind.toUpperCase(), r.country_name, r.trip_title]
                .filter(Boolean)
                .join(' · ');
              // Search RPC returns trip_user_id but not the voucher's
              // display_name (search_friend_graph migration 11 didn't
              // join users). Voucher attribution skipped until that
              // RPC is widened — see follow-up.
              return (
                <EntityCard
                  key={`${r.kind}-${r.id}`}
                  name={r.name}
                  area={area || null}
                  quote={r.quote}
                  voucherName={null}
                  vouchedAt={r.created_at ? new Date(r.created_at) : null}
                  glyph={
                    <View style={[styles.kindGlyph, kindStyle(r.kind)]}>
                      <Text style={styles.kindLetter}>{kindLetter(r.kind)}</Text>
                    </View>
                  }
                  rightSlot={<Text style={styles.chevron}>›</Text>}
                  onPress={() => onRowPress(r)}
                />
              );
            })}
          </View>
        </View>
      )}
    </Page>
  );
}

const kindLetter = (k: string): string => {
  if (k === 'country') return 'CO';
  if (k === 'city') return 'CT';
  if (k === 'venue') return 'V';
  if (k === 'area') return 'A';
  if (k === 'tip') return 'T';
  return '?';
};

const kindStyle = (k: string) => {
  if (k === 'country') return { backgroundColor: '#FFE7DE' };
  if (k === 'city') return { backgroundColor: '#E7F3FF' };
  if (k === 'venue') return { backgroundColor: '#FFF6D6' };
  if (k === 'area') return { backgroundColor: '#E8F5E9' };
  return { backgroundColor: TINT };
};

const styles = StyleSheet.create({
  headline: {
    fontFamily: 'PlayfairDisplay_500Medium',
    fontSize: 36,
    lineHeight: 40,
    color: INK,
    letterSpacing: -0.8,
    marginTop: 16,
  },
  searchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: TINT,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 16,
  },
  searchGlyph: { fontSize: 18, color: MUTE },
  searchInput: {
    flex: 1,
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    color: INK,
    paddingVertical: 2,
  },
  hint: {
    marginTop: 20,
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    lineHeight: 20,
    color: MUTE,
  },
  emptyCard: {
    marginTop: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: HAIR,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
  },
  emptyTitle: {
    fontFamily: 'PlayfairDisplay_500Medium',
    fontSize: 22,
    color: INK,
    letterSpacing: -0.4,
  },
  emptyBody: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    lineHeight: 20,
    color: MUTE,
    marginTop: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: HAIR,
  },
  kindGlyph: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kindLetter: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 10,
    letterSpacing: 0.8,
    color: INK,
  },
  rowName: {
    fontFamily: 'PlayfairDisplay_500Medium',
    fontSize: 20,
    color: INK,
    letterSpacing: -0.4,
  },
  rowMeta: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 9,
    letterSpacing: 1.2,
    color: MUTE,
    marginTop: 2,
  },
  rowQuote: {
    fontFamily: 'PlayfairDisplay_500Medium',
    fontSize: 14,
    lineHeight: 20,
    color: INK,
    marginTop: 6,
  },
  chevron: { fontFamily: 'PlayfairDisplay_500Medium', fontSize: 26, color: MUTE },
});
