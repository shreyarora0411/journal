import { Eyebrow, Face, Page, StatusSpace, Wordmark } from '@/components';
import { useFeed } from '@/features/feed';
import { log } from '@/lib/log';
import { Link, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

const CORAL = '#FF4D2E';
const INK = '#1A1410';
const MUTE = '#7A716A';
const HAIR = '#EFEAE2';

/**
 * Feed (Book tab) — real data only.
 *
 * Lists the trips visible to the current user, reverse-chronological,
 * via the `useFeed` infinite query. RLS handles visibility on the
 * server side; the client just renders.
 *
 * Empty state for a new user: a single quiet CTA to log their first
 * tip or trip. Deliberately not populated with fake friend cards —
 * the value prop reveals itself the first time a real friend posts.
 *
 * Heart counts on cards are hidden until verdict aggregation is wired
 * across the new venue-based atomic-log table (deferred).
 */
export function FeedScreen() {
  const router = useRouter();
  const q = useFeed();

  useEffect(() => {
    log.event('feed.screen_entered');
  }, []);

  const rows = (q.data?.pages ?? []).flatMap((p) => p.rows);

  return (
    <Page>
      <StatusSpace />

      {/* Header — wordmark + search + own face */}
      <View style={styles.header}>
        <Wordmark size="md" />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Link href="/(tabs)/search" asChild>
            <Pressable accessibilityRole="button" accessibilityLabel="Search">
              <Text style={styles.headerGlyph}>⌕</Text>
            </Pressable>
          </Link>
          <Link href="/(tabs)/you" asChild>
            <Pressable accessibilityRole="button" accessibilityLabel="Your profile">
              <Face initials="ME" size="sm" />
            </Pressable>
          </Link>
        </View>
      </View>

      {q.isLoading ? (
        <Text style={styles.empty}>Loading…</Text>
      ) : rows.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Quiet here.</Text>
          <Text style={styles.emptyBody}>
            Pop a tip in the book or frame a trip. When friends start logging too, this is where
            they'll show up.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Log your first tip"
            onPress={() => router.push('/(tabs)/add' as never)}
            style={styles.emptyCta}
          >
            <Text style={styles.emptyCtaLabel}>Add to my book ✦</Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ marginTop: 18, gap: 14 }}>
          <Eyebrow>Fresh from my circle</Eyebrow>
          {rows.map((t) => (
            <Pressable
              key={t.id}
              accessibilityRole="button"
              accessibilityLabel={`${t.author?.display_name ?? 'Someone'}'s trip: ${t.title}`}
              onPress={() => router.push(`/trip/${t.id}` as never)}
              style={styles.card}
            >
              <View style={styles.friendRow}>
                <Face
                  uri={t.author?.avatar_url ?? null}
                  initials={(t.author?.display_name ?? t.author?.handle ?? '?')
                    .slice(0, 2)
                    .toUpperCase()}
                  size="sm"
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.friendName}>
                    {t.author?.display_name ?? t.author?.handle ?? 'Someone'}
                  </Text>
                  <Text style={styles.friendWhen}>
                    {new Date(t.created_at).toDateString().toUpperCase()}
                  </Text>
                </View>
              </View>
              <Text style={styles.tripTitle}>{t.title}</Text>
              {t.note ? (
                <Text style={styles.note} numberOfLines={3}>
                  {t.note}
                </Text>
              ) : null}
            </Pressable>
          ))}
        </View>
      )}
    </Page>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
  },
  headerGlyph: { fontSize: 22, color: INK },
  empty: { fontFamily: 'Geist_400Regular', fontSize: 13, color: MUTE, marginTop: 32 },
  emptyCard: {
    marginTop: 32,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: HAIR,
    padding: 22,
  },
  emptyTitle: {
    fontFamily: 'InstrumentSerif_400Italic',
    fontSize: 32,
    color: INK,
    letterSpacing: -0.6,
  },
  emptyBody: {
    fontFamily: 'Geist_400Regular',
    fontSize: 14,
    lineHeight: 22,
    color: MUTE,
    marginTop: 10,
  },
  emptyCta: {
    marginTop: 18,
    backgroundColor: CORAL,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
  },
  emptyCtaLabel: {
    fontFamily: 'Geist_500Medium',
    fontSize: 15,
    color: '#FFFFFF',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
    borderWidth: 1,
    borderColor: HAIR,
  },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  friendName: {
    fontFamily: 'Geist_500Medium',
    fontSize: 14,
    color: INK,
  },
  friendWhen: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 9,
    letterSpacing: 1.2,
    color: MUTE,
    marginTop: 2,
  },
  tripTitle: {
    fontFamily: 'InstrumentSerif_400Italic',
    fontSize: 24,
    color: INK,
    letterSpacing: -0.4,
  },
  note: {
    fontFamily: 'Geist_400Regular',
    fontSize: 14,
    lineHeight: 22,
    color: MUTE,
    marginTop: 8,
  },
});
