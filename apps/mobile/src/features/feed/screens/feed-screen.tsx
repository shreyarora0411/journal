import { Face, Page, StatusSpace } from '@/components';
import { useFeed } from '@/features/feed';
import { useVouchFeed, type FeedVouch } from '../api/use-vouch-feed';
import { useAtomicLogFeed, type AtomicLogRow } from '@/features/trips';
import { getPhotoUrl } from '@/features/trips/lib/photo-url';
import { useWishlistRows } from '@/features/wishlist';
import { formatVouchDate } from '@/lib/format-vouch-date';
import { tryGooglePlacesPhoto } from '@/lib/hero-photo';
import { log } from '@/lib/log';
import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { Link, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

const CORAL = '#FF4D2E';
const INK = '#1A1410';
const MUTE = '#7A716A';
const FAINT = '#B7AE9F';
const HAIR = '#EFEAE2';
const CARD = '#FFFDF9';

type FilterKey =
  | 'all'
  | 'food'
  | 'drinks'
  | 'nightlife'
  | 'stay'
  | 'wander'
  | 'do'
  | 'buy';
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'food', label: 'Food' },
  { key: 'drinks', label: 'Drinks' },
  { key: 'nightlife', label: 'Nightlife' },
  { key: 'stay', label: 'Stays' },
  { key: 'wander', label: 'Wander' },
  { key: 'do', label: 'Do' },
  { key: 'buy', label: 'Buy' },
];

// Pill colors per category — match the reference's soft swatches so the
// card's category badge reads at a glance.
const CAT_PILL: Record<string, { fg: string; bg: string; label: string }> = {
  food:      { fg: '#B23A14', bg: '#FBE6DC', label: 'Food' },
  drinks:    { fg: '#7B3F5C', bg: '#F4E3EA', label: 'Drinks' },
  nightlife: { fg: '#4A1F40', bg: '#EFD8E8', label: 'Nightlife' },
  stay:      { fg: '#4E6B45', bg: '#E6EEDF', label: 'Stays' },
  wander:    { fg: '#2F5E6E', bg: '#DEEBEF', label: 'Wander' },
  do:        { fg: '#1F5F5C', bg: '#D6E9E7', label: 'Do' },
  buy:       { fg: '#7A3A20', bg: '#F2E2D2', label: 'Buy' },
};

// Duotone "photo" gradient per category — we don't ship real photos for
// every venue, so the cover is a category-keyed gradient block. Matches
// the reference's photo_grad concept.
const CAT_GRAD: Record<string, [string, string]> = {
  food:      ['#F2A65A', '#7A2E12'],
  drinks:    ['#C77B9A', '#2B1726'],
  // Nightlife — moodier, late-night purple-to-black gradient.
  nightlife: ['#8B3A6F', '#1A0E16'],
  stay:      ['#9DBE8A', '#2E3D2A'],
  wander:    ['#F5B05C', '#6E2A5A'],
  // Do — active/outdoor; teal-to-deep-sea gradient.
  do:        ['#5DA8A4', '#1F3F46'],
  buy:       ['#E8A765', '#7A3A20'],
};

const DEFAULT_GRAD: [string, string] = ['#D9A441', '#8A5A1B'];

// ---- Card cover: real photo if we have one, else duotone gradient ---------
// Resolution chain: user upload → Google Places (smart picker — best
// scored by resolution + landscape + attribution). Unsplash was tried
// but doesn't carry specific local venues (Smokey Jo's Cafe, Shankar
// Vadapav, etc.), so we go straight to Google. Cached 24h per place_id.
function useVenuePhoto(storagePath?: string | null, googlePlaceId?: string | null) {
  const [userUrl, setUserUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!storagePath) {
      setUserUrl(null);
      return;
    }
    let cancelled = false;
    getPhotoUrl(storagePath).then((u) => {
      if (!cancelled) setUserUrl(u);
    });
    return () => {
      cancelled = true;
    };
  }, [storagePath]);

  const googleQ = useQuery({
    // v2 = smart picker (scored by resolution + landscape + attribution).
    // Bumping the key invalidates first-photo URLs cached before this fix.
    queryKey: ['venue-google-photo-v2', googlePlaceId],
    queryFn: () => (googlePlaceId ? tryGooglePlacesPhoto(googlePlaceId) : null),
    enabled: Boolean(googlePlaceId) && !storagePath && !userUrl,
    staleTime: 24 * 60 * 60 * 1000,
  });

  return userUrl ?? googleQ.data?.url ?? null;
}

// ---- date formatting ------------------------------------------------------
// Replaced the local relativeDay helper with formatVouchDate
// (src/lib/format-vouch-date.ts) per Round 2 — every vouch surface uses
// the same freshness flag so stale vouches de-emphasize consistently.

function tripRange(start?: string | null, end?: string | null): string | null {
  if (!start) return null;
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const a = new Date(start);
  const b = end ? new Date(end) : null;
  const aLabel = `${MONTHS[a.getMonth()]} ${a.getDate()}`;
  if (!b) return aLabel;
  if (a.getMonth() === b.getMonth()) return `${aLabel}–${b.getDate()}`;
  return `${aLabel} – ${MONTHS[b.getMonth()]} ${b.getDate()}`;
}

/**
 * Feed (Book tab).
 *
 * Shows what the user's circle has saved — never the user's own content
 * (own work lives on Profile). Filter pills narrow by category. Trips
 * carousel is only visible on the All filter so a category filter never
 * silently includes off-category trip rows.
 */
export function FeedScreen() {
  const router = useRouter();
  const tripsQ = useFeed();
  const tipsQ = useAtomicLogFeed(50);
  const vouchQ = useVouchFeed(40);
  const wishlistQ = useWishlistRows();
  const savedCount = wishlistQ.data?.length ?? 0;
  const [filter, setFilter] = useState<FilterKey>('all');
  const [selected, setSelected] = useState<AtomicLogRow | null>(null);

  useEffect(() => {
    log.event('feed.screen_entered');
  }, []);

  const tripRows = tripsQ.data?.pages.flatMap((p) => p.rows) ?? [];
  const tipRows: AtomicLogRow[] = tipsQ.data ?? [];
  const vouchRows = vouchQ.data ?? [];

  const visibleTips = useMemo(
    () => (filter === 'all' ? tipRows : tipRows.filter((t) => t.category === filter)),
    [filter, tipRows],
  );

  /**
   * Group tips into city buckets. The reference (and the user's mental
   * model) treats city as the natural container for tips — a flat list
   * scans like a stream, where a grouped list scans like an atlas.
   *
   * Tips with no `city.name` fall into a single "Other" bucket pinned
   * to the bottom. Bucket order: most-recent activity first (i.e. the
   * city whose newest tip is newest goes on top).
   */
  const tipsByCity = useMemo(() => {
    const groups = new Map<string, { label: string; rows: AtomicLogRow[] }>();
    for (const t of visibleTips) {
      const key = t.city?.name ?? '__other__';
      const label = t.city
        ? t.city.country?.display_name
          ? `${t.city.name}, ${t.city.country.display_name}`
          : t.city.name
        : 'Other';
      const bucket = groups.get(key) ?? { label, rows: [] };
      bucket.rows.push(t);
      groups.set(key, bucket);
    }
    return [...groups.entries()]
      .map(([key, b]) => ({ key, label: b.label, rows: b.rows }))
      .sort((a, b) => {
        if (a.key === '__other__') return 1;
        if (b.key === '__other__') return -1;
        const aMost = a.rows[0]?.created_at ?? '';
        const bMost = b.rows[0]?.created_at ?? '';
        return bMost.localeCompare(aMost);
      });
  }, [visibleTips]);
  const hasAnyContent = tripRows.length > 0 || tipRows.length > 0 || vouchRows.length > 0;
  const loading = tripsQ.isLoading || tipsQ.isLoading || vouchQ.isLoading;

  return (
    <Page>
      <StatusSpace />

      {/* Header — wordmark, search, own avatar */}
      <View style={styles.header}>
        <Text accessibilityLabel="lore." style={styles.wordmark}>
          lore<Text style={styles.wordmarkDot}>.</Text>
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          {/* Saved counter — Bookmark glyph + live count from wishlist. */}
          <Link href="/(tabs)/wishlist" asChild>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Saved: ${savedCount}`}
              style={styles.savedCounter}
            >
              <Text style={[styles.bookmarkGlyph, savedCount > 0 && { color: CORAL }]}>🔖</Text>
              <Text
                style={[styles.savedCount, savedCount > 0 && { color: CORAL }]}
              >
                {savedCount}
              </Text>
            </Pressable>
          </Link>
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

      {/* Segmented filter — horizontal scroll */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {FILTERS.map((f) => {
          const on = filter === f.key;
          return (
            <Pressable
              key={f.key}
              accessibilityRole="button"
              accessibilityLabel={`Filter: ${f.label}`}
              onPress={() => setFilter(f.key)}
              style={[
                styles.filterPill,
                on ? styles.filterPillOn : styles.filterPillOff,
              ]}
            >
              <Text style={[styles.filterLabel, on ? styles.filterLabelOn : styles.filterLabelOff]}>
                {f.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {loading ? (
        <Text style={styles.empty}>Loading…</Text>
      ) : !hasAnyContent ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Quiet here.</Text>
          <Text style={styles.emptyBody}>
            When friends start logging tips and trips, this is where they'll show up.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add your first tip"
            onPress={() => router.push('/(tabs)/add' as never)}
            style={styles.emptyCta}
          >
            <Text style={styles.emptyCtaLabel}>Add to my book ✦</Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ marginTop: 18, gap: 26 }}>
          {/* Trips carousel — All filter only, so a category never lies */}
          {filter === 'all' && tripRows.length > 0 ? (
            <View>
              <Text style={styles.eyebrow}>Trips from your circle</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.tripCarousel}
              >
                {tripRows.map((t) => {
                  const grad = DEFAULT_GRAD;
                  const range = tripRange(t.start_date, t.end_date);
                  const who = t.author?.display_name ?? t.author?.handle ?? 'Someone';
                  return (
                    <Pressable
                      key={`trip-${t.id}`}
                      accessibilityRole="button"
                      accessibilityLabel={`${who}'s trip: ${t.title}`}
                      onPress={() => router.push(`/(tabs)/trip/${t.id}` as never)}
                      style={styles.tripCard}
                    >
                      <View style={styles.tripCover}>
                        <LinearGradient
                          colors={grad}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={StyleSheet.absoluteFill}
                        />
                        {/* Date-range chip overlay (bottom-left). The
                            reference shows "N places" — pending a places
                            count query, we surface the trip dates here
                            so the cover doesn't read as empty. */}
                        {range ? (
                          <View style={styles.placesChip}>
                            <Text style={styles.placesChipLabel}>{range}</Text>
                          </View>
                        ) : null}
                      </View>
                      <View style={{ padding: 14 }}>
                        <Text style={styles.tripTitle} numberOfLines={2}>
                          {t.title}
                        </Text>
                        <View style={styles.tripMeta}>
                          <Face
                            uri={t.author?.avatar_url ?? null}
                            initials={who.slice(0, 2).toUpperCase()}
                            size="sm"
                          />
                          <Text style={styles.tripWho} numberOfLines={1}>
                            {who}
                          </Text>
                          {range ? (
                            <>
                              <Text style={styles.tripDot}>·</Text>
                              <Text style={styles.tripDate}>{range}</Text>
                            </>
                          ) : null}
                        </View>
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          ) : null}

          {/* Vouches from your circle (v3) — shown on All so a category
              filter (old atomic-log taxonomy) never silently hides them. */}
          {filter === 'all' && vouchRows.length > 0 ? (
            <View style={{ gap: 12 }}>
              <Text style={styles.eyebrow}>Vouches from your circle</Text>
              {vouchRows.map((v) => (
                <VouchFeedCard key={`vouch-${v.id}`} vouch={v} />
              ))}
            </View>
          ) : null}

          {/* Tips section */}
          <View style={{ gap: 14 }}>
            <Text style={styles.eyebrow}>
              {filter === 'all'
                ? 'Saved by your circle'
                : `${FILTERS.find((f) => f.key === filter)?.label} · your circle`}
            </Text>

            {visibleTips.length === 0 ? (
              <View style={styles.filterEmpty}>
                <Text style={styles.filterEmptyGlyph}>🧭</Text>
                <Text style={styles.filterEmptyTitle}>Nothing here yet</Text>
                <Text style={styles.filterEmptyBody}>
                  When someone in your circle saves a{' '}
                  {(FILTERS.find((f) => f.key === filter)?.label ?? '').toLowerCase()} spot, it'll
                  land right here.
                </Text>
              </View>
            ) : (
              tipsByCity.map((bucket) => (
                <View key={`bucket-${bucket.key}`} style={{ gap: 14 }}>
                  <View style={styles.cityHeaderRow}>
                    <Text style={styles.cityHeaderPin}>◉</Text>
                    <Text style={styles.cityHeaderLabel}>{bucket.label}</Text>
                    <View style={styles.cityHeaderRule} />
                    <Text style={styles.cityHeaderCount}>{bucket.rows.length}</Text>
                  </View>
                  {bucket.rows.map((t) => (
                    <TipCard key={`tip-${t.id}`} row={t} onOpen={setSelected} />
                  ))}
                </View>
              ))
            )}
          </View>

          <Text style={styles.caughtUp}>you're all caught up with your circle</Text>
        </View>
      )}

      <DetailSheet row={selected} onClose={() => setSelected(null)} />
    </Page>
  );
}

// ---- Vouch feed card (v3) -------------------------------------------------
const VOUCH_PILL: Record<string, { label: string; fg: string; bg: string }> = {
  stay: { label: 'Stay', fg: '#4E6B45', bg: '#E6EEDF' },
  eat_drink: { label: 'Eat / Drink', fg: '#B23A14', bg: '#FBE6DC' },
  do: { label: 'Do', fg: '#1F5F5C', bg: '#D6E9E7' },
  good_to_know: { label: 'Good to know', fg: '#2F5E6E', bg: '#DEEBEF' },
  skip: { label: 'Skip', fg: '#7A3A20', bg: '#F2E2D2' },
};

function VouchFeedCard({ vouch }: { vouch: FeedVouch }) {
  const pill = VOUCH_PILL[vouch.vouch_type] ?? VOUCH_PILL.do!;
  const who = vouch.author?.display_name ?? vouch.author?.handle ?? 'Someone';
  const reason = `${who} vouched · ${vouch.destination_text}`;
  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={`${pill.label}: ${vouch.text}`}
      style={styles.card}
    >
      <View style={styles.cardBody}>
        <View style={styles.friendRow}>
          <Face
            uri={vouch.author?.avatar_url ?? null}
            initials={who.slice(0, 2).toUpperCase()}
            size="sm"
          />
          <Text style={styles.friendName} numberOfLines={1}>
            {who}
          </Text>
          <View style={[styles.catPill, { backgroundColor: pill.bg, position: 'relative', top: 0, left: 0, marginLeft: 'auto' }]}>
            <Text style={[styles.catPillLabel, { color: pill.fg }]}>{pill.label}</Text>
          </View>
        </View>
        <Text style={styles.cardQuote} numberOfLines={4}>
          "{vouch.text}"
        </Text>
        <Text style={styles.vouchReason}>{reason.toUpperCase()}</Text>
      </View>
    </View>
  );
}

// ---- Tip card -------------------------------------------------------------
function TipCard({
  row,
  onOpen,
}: {
  row: AtomicLogRow;
  onOpen: (row: AtomicLogRow) => void;
}) {
  const cat = (row.category ?? 'wander') as keyof typeof CAT_PILL;
  const pill = CAT_PILL[cat] ?? CAT_PILL.wander!;
  const grad = CAT_GRAD[cat] ?? DEFAULT_GRAD;
  const who = row.author?.display_name ?? row.author?.handle ?? 'Someone';
  const cityName = row.city?.name ?? null;
  const country = row.city?.country?.display_name ?? null;
  const cityLabel = cityName && country ? `${cityName}, ${country}` : cityName;
  const photoUrl = useVenuePhoto(row.cover_photo_path, row.google_place_id);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${who}'s tip: ${row.name}`}
      onPress={() => onOpen(row)}
      style={styles.card}
    >
      {/* Cover — real photo if available, else duotone gradient. The
          soft bottom gradient overlay gives the category pill / save
          bookmark a clean float instead of fighting the underlying photo. */}
      <View style={styles.cardCover}>
        {photoUrl ? (
          <Image
            source={{ uri: photoUrl }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <LinearGradient
            colors={grad}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        )}
        <LinearGradient
          colors={['rgba(0,0,0,0.32)', 'transparent', 'rgba(0,0,0,0.18)']}
          locations={[0, 0.5, 1]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <View style={[styles.catPill, { backgroundColor: pill.bg }]}>
          <Text style={[styles.catPillLabel, { color: pill.fg }]}>{pill.label}</Text>
        </View>
        <View style={styles.savePill}>
          <Text style={styles.savePillGlyph}>🔖</Text>
        </View>
      </View>

      {/* Body */}
      <View style={styles.cardBody}>
        <View style={styles.friendRow}>
          <Face
            uri={row.author?.avatar_url ?? null}
            initials={who.slice(0, 2).toUpperCase()}
            size="sm"
          />
          <Text style={styles.friendName} numberOfLines={1}>
            {who}
          </Text>
          <Text style={styles.tripDot}>·</Text>
          {(() => {
            const d = formatVouchDate(new Date(row.created_at));
            return (
              <Text
                style={[styles.friendWhen, d.freshness === 'stale' && styles.friendWhenStale]}
              >
                {d.display}
              </Text>
            );
          })()}
        </View>

        <Text style={styles.cardTitle} numberOfLines={1}>
          {row.name}
        </Text>

        {row.one_line ? (
          <Text style={styles.cardQuote} numberOfLines={1}>
            “{row.one_line}”
          </Text>
        ) : null}

        <View style={styles.cardFooter}>
          {cityLabel ? (
            <View style={styles.cityRow}>
              <Text style={styles.cityPin}>◉</Text>
              <Text style={styles.cityText} numberOfLines={1}>
                {cityLabel}
              </Text>
            </View>
          ) : (
            <View />
          )}
          <View style={styles.lovedRow}>
            <Text style={styles.lovedGlyph}>♥</Text>
            <Text style={styles.lovedLabel}>Loved</Text>
            <Text style={styles.chevron}>›</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

// ---- Detail sheet ---------------------------------------------------------
// Slide-up modal that shows the full venue context — friend, full quote,
// hero photo/gradient. Replaces the dead-end `/(tabs)/place/[id]` route
// (that screen reads fixtures, not real venue UUIDs).
function DetailSheet({ row, onClose }: { row: AtomicLogRow | null; onClose: () => void }) {
  const photoUrl = useVenuePhoto(row?.cover_photo_path, row?.google_place_id);
  if (!row) return null;

  const cat = (row.category ?? 'wander') as keyof typeof CAT_PILL;
  const pill = CAT_PILL[cat] ?? CAT_PILL.wander!;
  const grad = CAT_GRAD[cat] ?? DEFAULT_GRAD;
  const who = row.author?.display_name ?? row.author?.handle ?? 'Someone';
  const cityName = row.city?.name ?? null;
  const country = row.city?.country?.display_name ?? null;
  const cityLabel = cityName && country ? `${cityName}, ${country}` : cityName;

  return (
    <Modal
      visible
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.sheetBackdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Hero */}
          <View style={styles.sheetHero}>
            {photoUrl ? (
              <Image
                source={{ uri: photoUrl }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
              />
            ) : (
              <LinearGradient
                colors={grad}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
            )}
            <View style={[styles.catPill, { backgroundColor: pill.bg, top: 16, left: 16 }]}>
              <Text style={[styles.catPillLabel, { color: pill.fg }]}>{pill.label}</Text>
            </View>
            <Pressable accessibilityLabel="Close" onPress={onClose} style={styles.sheetClose}>
              <Text style={styles.sheetCloseGlyph}>✕</Text>
            </Pressable>
            <View style={styles.sheetHeroText}>
              <Text style={styles.sheetTitle} numberOfLines={2}>
                {row.name}
              </Text>
              {cityLabel ? (
                <Text style={styles.sheetCity} numberOfLines={1}>
                  ◉ {cityLabel}
                </Text>
              ) : null}
            </View>
          </View>

          {/* Body */}
          <View style={styles.sheetBody}>
            <View style={styles.sheetFriendRow}>
              <Face
                uri={row.author?.avatar_url ?? null}
                initials={who.slice(0, 2).toUpperCase()}
                size="md"
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetFriendName}>{who}</Text>
                <Text style={styles.sheetFriendWhen}>
                  vouched · {formatVouchDate(new Date(row.created_at)).display}
                </Text>
              </View>
              <View style={styles.lovedRow}>
                <Text style={styles.lovedGlyph}>♥</Text>
                <Text style={styles.lovedLabel}>Loved</Text>
              </View>
            </View>

            {row.one_line ? (
              <Text style={styles.sheetQuote}>“{row.one_line}”</Text>
            ) : null}
            {row.prose ? (
              <Text style={styles.sheetProse}>{row.prose}</Text>
            ) : null}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
  },
  wordmark: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 28,
    color: INK,
    letterSpacing: -0.5,
  },
  wordmarkDot: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 28,
    color: CORAL,
  },
  headerGlyph: { fontSize: 22, color: INK },
  savedCounter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  bookmarkGlyph: { fontSize: 16, color: MUTE },
  savedCount: { fontFamily: 'DMSans_600SemiBold', fontSize: 13, color: MUTE },

  // Filter pills
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 14,
    paddingRight: 8,
  },
  filterPill: {
    paddingHorizontal: 15,
    paddingVertical: 7,
    borderRadius: 999,
  },
  filterPillOn: { backgroundColor: CORAL },
  filterPillOff: { borderWidth: 1, borderColor: HAIR, backgroundColor: 'transparent' },
  filterLabel: { fontFamily: 'DMSans_600SemiBold', fontSize: 13.5 },
  filterLabelOn: { color: '#FFFFFF' },
  filterLabelOff: { color: MUTE },

  // Empty (no content at all)
  empty: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: MUTE, marginTop: 32 },
  emptyCard: {
    marginTop: 32,
    backgroundColor: CARD,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: HAIR,
    padding: 22,
  },
  emptyTitle: {
    fontFamily: 'PlayfairDisplay_500Medium',
    fontSize: 32,
    color: INK,
    letterSpacing: -0.6,
  },
  emptyBody: {
    fontFamily: 'DMSans_400Regular',
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
  emptyCtaLabel: { fontFamily: 'DMSans_600SemiBold', fontSize: 15, color: '#FFFFFF' },

  // Per-filter empty
  filterEmpty: {
    backgroundColor: CARD,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: HAIR,
    borderStyle: 'dashed',
    padding: 28,
    alignItems: 'center',
  },
  filterEmptyGlyph: { fontSize: 30, marginBottom: 10 },
  filterEmptyTitle: {
    fontFamily: 'PlayfairDisplay_500Medium',
    fontSize: 22,
    color: INK,
    marginBottom: 6,
  },
  filterEmptyBody: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13.5,
    lineHeight: 20,
    color: MUTE,
    textAlign: 'center',
  },

  // City bucket header — sits above each group of tips. Pin glyph +
  // city label + thin rule + count chip, like the section dividers in
  // an atlas. Honors the "trip is a container, city is the bucket"
  // model the user articulated.
  cityHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 4,
  },
  cityHeaderPin: { fontSize: 10, color: CORAL },
  cityHeaderLabel: {
    fontFamily: 'PlayfairDisplay_500Medium',
    fontSize: 20,
    color: INK,
    letterSpacing: -0.3,
  },
  cityHeaderRule: { flex: 1, height: 1, backgroundColor: HAIR, marginHorizontal: 4 },
  cityHeaderCount: { fontFamily: 'DMSans_600SemiBold', fontSize: 12, color: FAINT },

  // Section eyebrow
  eyebrow: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 11,
    letterSpacing: 1.6,
    color: FAINT,
    textTransform: 'uppercase',
    marginBottom: 12,
  },

  // Trips carousel
  tripCarousel: { gap: 14, paddingRight: 14 },
  tripCard: {
    width: 210,
    backgroundColor: CARD,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: HAIR,
  },
  tripCover: { height: 116 },
  tripTitle: {
    fontFamily: 'PlayfairDisplay_500Medium',
    fontSize: 20,
    lineHeight: 22,
    color: INK,
    letterSpacing: -0.4,
  },
  tripMeta: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 9 },
  tripWho: { fontFamily: 'DMSans_600SemiBold', fontSize: 12.5, color: MUTE, flexShrink: 1 },
  tripDot: { color: FAINT, fontSize: 12 },
  tripDate: { fontFamily: 'DMSans_400Regular', fontSize: 12.5, color: FAINT },

  // Tip card
  card: {
    backgroundColor: CARD,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: HAIR,
  },
  cardCover: {
    height: 200,
    position: 'relative',
  },
  catPill: {
    position: 'absolute',
    top: 12,
    left: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  catPillLabel: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 11,
    letterSpacing: 0.3,
  },
  cardBody: { padding: 16 },
  friendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  friendName: { fontFamily: 'DMSans_600SemiBold', fontSize: 13.5, color: INK },
  friendWhen: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: FAINT },
  // 70% opacity on stale vouches (> 12 months) — they still appear,
  // but read with less authority than recent ones.
  friendWhenStale: { opacity: 0.7 },
  cardTitle: {
    // Upright Playfair (not italic) per the reference snapshot — the
    // venue name reads as a proper noun / brand mark; italic was
    // making it look like another pull-quote.
    fontFamily: 'PlayfairDisplay_500Medium',
    fontSize: 22,
    lineHeight: 25,
    color: INK,
    letterSpacing: -0.4,
    marginTop: 11,
  },
  cardQuote: {
    // Italic — this is a pull-quote ("Order the hand drip..."), the one
    // place on the card where italic Playfair is the right voice.
    fontFamily: 'PlayfairDisplay_500Medium_Italic',
    fontSize: 15,
    lineHeight: 21,
    color: MUTE,
    marginTop: 6,
  },
  vouchReason: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 10,
    letterSpacing: 1,
    color: FAINT,
    marginTop: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 13,
  },
  cityRow: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1 },
  cityPin: { fontSize: 10, color: FAINT },
  cityText: { fontFamily: 'DMSans_600SemiBold', fontSize: 13, color: MUTE, flexShrink: 1 },
  chevron: { fontSize: 22, color: FAINT, lineHeight: 22, marginLeft: 4 },

  // Save bookmark — round white button top-right of cover. Visual port;
  // wiring to wishlist is a follow-up.
  savePill: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 36,
    height: 36,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  savePillGlyph: { fontSize: 18, color: INK, lineHeight: 20 },

  // Loved/Mid rating — coral heart + label, sits next to chevron.
  lovedRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  lovedGlyph: { fontSize: 13, color: CORAL },
  lovedLabel: { fontFamily: 'DMSans_600SemiBold', fontSize: 12, color: CORAL },

  // Trip carousel "places" chip — sits bottom-left of gradient cover.
  placesChip: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    backgroundColor: 'rgba(0,0,0,0.28)',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
  },
  placesChipLabel: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 11,
    color: '#FFFFFF',
  },

  caughtUp: {
    // Italic — "you're all caught up" is a tonal sign-off, not a title.
    fontFamily: 'PlayfairDisplay_500Medium_Italic',
    fontSize: 13.5,
    color: FAINT,
    textAlign: 'center',
    paddingVertical: 24,
  },

  // Detail sheet
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(40,28,18,0.42)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '88%',
    backgroundColor: '#FAF5EC',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    overflow: 'hidden',
  },
  sheetHero: { height: 250, position: 'relative' },
  sheetClose: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetCloseGlyph: { fontSize: 14, color: INK },
  sheetHeroText: { position: 'absolute', left: 20, right: 20, bottom: 16 },
  sheetTitle: {
    fontFamily: 'PlayfairDisplay_500Medium',
    fontSize: 30,
    color: '#FFFFFF',
    lineHeight: 34,
    letterSpacing: -0.5,
  },
  sheetCity: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 13.5,
    color: 'rgba(255,255,255,0.95)',
    marginTop: 6,
  },
  sheetBody: { padding: 20, gap: 16 },
  sheetFriendRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sheetFriendName: { fontFamily: 'DMSans_600SemiBold', fontSize: 14.5, color: INK },
  sheetFriendWhen: { fontFamily: 'DMSans_400Regular', fontSize: 12.5, color: FAINT, marginTop: 2 },
  sheetQuote: {
    // Italic — the big pull-quote inside the detail sheet.
    fontFamily: 'PlayfairDisplay_500Medium_Italic',
    fontSize: 21,
    lineHeight: 30,
    color: INK,
    marginTop: 4,
  },
  sheetProse: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14.5,
    lineHeight: 22,
    color: MUTE,
  },
});
