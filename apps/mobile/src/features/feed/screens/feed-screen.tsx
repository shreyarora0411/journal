import { Face, Icon, Page, StatusSpace } from '@/components';
import { useCirclePulse } from '@/features/feed';
import {
  type VouchSearchResult,
  useLatestDestinationSignal,
  useRecordInteraction,
  useVouchSearch,
} from '@/features/search';
import { useMyVouches, useVouchUses } from '@/features/trips';
import { useWishlistRows } from '@/features/wishlist';
import { log } from '@/lib/log';
import { Link, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Linking, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { type FeedVouch, useVouchFeed } from '../api/use-vouch-feed';

const CORAL = '#FF4D2E';
const INK = '#1A1410';
const MUTE = '#7A716A';
const FAINT = '#B7AE9F';
const HAIR = '#EFEAE2';
const CARD = '#FFFDF9';

/**
 * Feed (Book tab) — rebuilt as an intent desk.
 *
 * On-thesis engagement = UTILITY (the trusted answer resurfaced at the moment
 * of relevance) + SOCIAL CURRENCY (your tip got used) — not an Instagram
 * scroll. The home leads, top-to-bottom, with the two strongest hooks the old
 * home buried: the payoff (someone saved your vouch) and resurfacing (your
 * circle vouched for the place you're headed to). Each section is small and
 * only renders when it has content, so the home stays an intent desk, not a
 * wall of widgets. The circle's "lately" feed stays, but demoted below.
 */
export function FeedScreen() {
  const router = useRouter();
  const usesQ = useVouchUses();
  const myVouchesQ = useMyVouches();
  const wishlistQ = useWishlistRows();
  const vouchQ = useVouchFeed(40);
  const pulseQ = useCirclePulse();
  const pulse = pulseQ.data ?? { newThisWeek: 0, myVouchCount: 0, topCity: null };

  const savedCount = wishlistQ.data?.length ?? 0;

  useEffect(() => {
    log.event('feed.screen_entered');
  }, []);

  // 1. PAYOFF — saves of MY vouches by others. The altruistic return hook
  //    (concern-for-others): "your tip got used". Voice-forward, no counts.
  const uses = (usesQ.data ?? []).slice(0, 2);

  // 2. CONTEXTUAL SUPPLY — derive the most-recent destination the user vouched
  //    for, so the log CTA is "back from {there}?" instead of a cold prompt.
  const recentDest = myVouchesQ.data?.[0]?.destination_text?.trim() || null;

  // 3. RESURFACING — the moment-of-relevance engine, now driven by a REAL
  //    private signal: the destination the viewer actually SEARCHED (migration
  //    54), not the old heuristic that relabelled the first wishlist row an
  //    "upcoming trip" (a fabricated claim). Falls back to a saved destination
  //    only when they haven't searched anything yet. Either way we never assert
  //    a travel date — just "here's your circle on the place you were looking at".
  const consideredSignal = useLatestDestinationSignal();
  const consideredDest = consideredSignal.data?.destination_text?.trim() || null;
  const savedDest =
    (wishlistQ.data ?? [])
      .map((w) => w.target_label?.trim())
      .find((label): label is string => Boolean(label)) ?? null;
  const resurfaceDest = consideredDest ?? savedDest;
  const resurfaceQ = useVouchSearch(resurfaceDest ?? '');
  const resurfaced = (resurfaceQ.data ?? []).slice(0, 3);

  // 5. LATELY — the circle's recent vouches, demoted below the hooks.
  const vouchRows = vouchQ.data ?? [];

  const hasAnyContent = uses.length > 0 || resurfaced.length > 0 || vouchRows.length > 0;
  const loading =
    usesQ.isLoading || myVouchesQ.isLoading || wishlistQ.isLoading || vouchQ.isLoading;

  return (
    <Page>
      <StatusSpace />

      {/* Header — wordmark, saved counter, search, own avatar */}
      <View style={styles.header}>
        <Text accessibilityLabel="Vouch." style={styles.wordmark}>
          Vouch<Text style={styles.wordmarkDot}>.</Text>
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <Link href="/(tabs)/wishlist" asChild>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Saved: ${savedCount}`}
              style={styles.savedCounter}
            >
              <Icon name="bookmark" size={16} color={savedCount > 0 ? CORAL : INK} />
              <Text style={[styles.savedCount, savedCount > 0 && { color: CORAL }]}>
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

      {loading ? (
        <Text style={styles.empty}>Loading…</Text>
      ) : !hasAnyContent ? (
        // Circle-less / fully empty: a warm two-step activation, not "log
        // content nobody sees". Step 1 banks a vouch (instant value to the
        // next friend); step 2 brings the circle in so the home fills.
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Start your circle.</Text>
          <Text style={styles.emptyBody}>
            Log a place you'd vouch for, then bring in the friends whose taste you trust — their
            vouches land right here.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Log one place"
            onPress={() => router.push('/(tabs)/add' as never)}
            style={styles.emptyCta}
          >
            <Text style={styles.emptyCtaLabel}>Log one place</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Invite your circle"
            onPress={() => router.push('/(tabs)/friends' as never)}
            style={styles.emptyCtaSecondary}
          >
            <Text style={styles.emptyCtaSecondaryLabel}>Invite your circle</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 8 }}
        >
          <View style={{ marginTop: 18, gap: 26 }}>
            {/* 1. PAYOFF BANNER — the highest-leverage return hook. Someone in
                the circle saved a vouch you wrote. Voice-forward, no counts. */}
            {uses.length > 0 ? (
              <View style={styles.payoffBanner}>
                {uses.map((u) => {
                  const who = u.saver_name ?? u.saver_handle ?? 'Someone';
                  const snippet =
                    u.vouch_text.length > 40
                      ? `${u.vouch_text.slice(0, 40).trimEnd()}…`
                      : u.vouch_text;
                  return (
                    <View key={`use-${u.vouch_id}-${u.saver_id}`} style={styles.payoffRow}>
                      <Face
                        uri={u.saver_avatar}
                        initials={who.slice(0, 2).toUpperCase()}
                        size="sm"
                      />
                      <Text style={styles.payoffText}>
                        <Text style={styles.payoffWho}>{who}</Text> saved your “{snippet}”
                      </Text>
                    </View>
                  );
                })}
              </View>
            ) : null}

            {/* 2. CONTEXTUAL SUPPLY CTA — replaces the static prompt. When the
                user has a recent vouch, lead with the place they just came back
                from; otherwise a generic prompt. One small card. */}
            <View style={styles.supplyRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.supplyTitle}>
                  {recentDest ? `More from ${recentDest}?` : 'Been somewhere good?'}
                </Text>
                <Text style={styles.supplyBody}>
                  {recentDest
                    ? 'Add another worth a vouch — the next friend headed there will find it.'
                    : 'Log a place you’d vouch for — the next friend headed there will find it.'}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Log a place"
                onPress={() => router.push('/(tabs)/add' as never)}
                style={styles.supplyCta}
              >
                <Text style={styles.supplyCtaLabel}>Log +</Text>
              </Pressable>
            </View>

            {/* 3. RESURFACING CARD — the circle's actual vouches for the place
                the viewer was last looking at (their own private search signal,
                or a saved destination). Honest framing: "your circle's picks for
                {dest}" — no assertion that they're travelling there or when. */}
            {resurfaceDest && resurfaced.length > 0 ? (
              <View style={{ gap: 12 }}>
                <Text style={styles.eyebrow}>{resurfaceDest} — your circle’s picks</Text>
                {resurfaced.map((r) => (
                  <ResurfaceVouch key={`resurface-${r.vouch_id}`} vouch={r} />
                ))}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`See all vouches for ${resurfaceDest}`}
                  onPress={() =>
                    router.push({
                      pathname: '/(tabs)/search',
                      params: { destination: resurfaceDest },
                    } as never)
                  }
                  style={styles.seeAllRow}
                >
                  <Text style={styles.seeAllLabel}>See all ›</Text>
                </Pressable>
              </View>
            ) : null}

            {/* 4. LIVENESS LINE — momentum signal. */}
            {pulse.newThisWeek > 0 ? (
              <Text style={styles.livenessLine}>
                {pulse.newThisWeek} new vouch{pulse.newThisWeek === 1 ? '' : 'es'} from your circle
                this week.
              </Text>
            ) : null}

            {/* 5. LATELY FEED — the circle's recent vouches, demoted below the
                hooks. Each card keeps its Maps + Share actions. */}
            {vouchRows.length > 0 ? (
              <View style={{ gap: 12 }}>
                <Text style={styles.eyebrow}>Lately from your circle</Text>
                {vouchRows.map((v) => (
                  <VouchFeedCard key={`vouch-${v.id}`} vouch={v} />
                ))}
              </View>
            ) : null}

            {/* 6. BELONGING NUDGE — quiet, bottom. Belonging, never points. */}
            {pulse.myVouchCount > 0 && pulse.topCity ? (
              <Text style={styles.belongingLine}>
                You’ve left {pulse.myVouchCount} vouch{pulse.myVouchCount === 1 ? '' : 'es'} — your
                circle leans on you for {pulse.topCity}.
              </Text>
            ) : null}

            <Text style={styles.caughtUp}>you're all caught up with your circle</Text>
          </View>
        </ScrollView>
      )}
    </Page>
  );
}

// ---- Vouch type pill palette ----------------------------------------------
const VOUCH_PILL: Record<string, { label: string; fg: string; bg: string }> = {
  stay: { label: 'Stay', fg: '#4E6B45', bg: '#E6EEDF' },
  eat_drink: { label: 'Eat / Drink', fg: '#B23A14', bg: '#FBE6DC' },
  do: { label: 'Do', fg: '#1F5F5C', bg: '#D6E9E7' },
  nightlife: { label: 'Nightlife', fg: '#4A1F40', bg: '#EFD8E8' },
  good_to_know: { label: 'Good to know', fg: '#2F5E6E', bg: '#DEEBEF' },
  skip: { label: 'Skip', fg: '#7A3A20', bg: '#F2E2D2' },
};

// Place-type vouches get an "Open in Maps" — a save/eat/do/nightlife vouch
// points at a real spot. good_to_know / skip don't (no single place to open).
const VOUCH_PLACE_TYPES = new Set(['stay', 'eat_drink', 'do', 'nightlife']);

// ---- Resurfacing vouch row (search result) --------------------------------
// A circle vouch for the user's upcoming (first-saved) destination, with the
// same act-on-it affordances as the Lately feed — Maps (precise pin when the
// place is resolved, else the lead-phrase heuristic, mirroring plan-screen)
// and Share.
function ResurfaceVouch({ vouch }: { vouch: VouchSearchResult }) {
  const pill = VOUCH_PILL[vouch.vouch_type] ?? VOUCH_PILL.do!;
  const who = vouch.author_name ?? vouch.author_handle ?? 'Someone';
  const recordInteraction = useRecordInteraction();

  const openMaps = () => {
    recordInteraction.mutate({ vouchId: vouch.vouch_id, kind: 'maps' });
    const lead = vouch.vouch_text.split(/[—–\-,.]/)[0]?.trim() || vouch.vouch_text;
    const url = vouch.place_google_id
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          vouch.place_name || `${lead}, ${vouch.destination_text}`,
        )}&query_place_id=${vouch.place_google_id}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          `${lead}, ${vouch.destination_text}`,
        )}`;
    Linking.openURL(url).catch((err) => log.error('open maps failed', err));
  };
  const shareVouch = () => {
    recordInteraction.mutate({ vouchId: vouch.vouch_id, kind: 'share' });
    Share.share({
      message: `"${vouch.vouch_text}" — ${who} vouched · ${vouch.destination_text}`,
    }).catch((err) => log.error('share vouch failed', err));
  };

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={`${pill.label}: ${vouch.vouch_text}`}
      style={styles.card}
    >
      <View style={styles.cardBody}>
        <View style={styles.friendRow}>
          <Face uri={vouch.author_avatar} initials={who.slice(0, 2).toUpperCase()} size="sm" />
          <Text style={styles.friendName} numberOfLines={1}>
            {who}
          </Text>
          <View style={[styles.catPill, { backgroundColor: pill.bg, marginLeft: 'auto' }]}>
            <Text style={[styles.catPillLabel, { color: pill.fg }]}>{pill.label}</Text>
          </View>
        </View>
        <Text style={styles.cardQuote} numberOfLines={4}>
          "{vouch.vouch_text}"
        </Text>
        <View style={styles.vouchActions}>
          {VOUCH_PLACE_TYPES.has(vouch.vouch_type) ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open in Maps"
              onPress={openMaps}
              hitSlop={12}
              style={styles.vouchActionBtn}
            >
              <Text style={styles.vouchActionLabel}>
                {vouch.place_google_id ? '↗ Maps · pinned' : '↗ Maps'}
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Share this vouch"
            onPress={shareVouch}
            hitSlop={12}
            style={styles.vouchActionBtn}
          >
            <Text style={styles.vouchActionLabel}>Share</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

// ---- Vouch feed card (v3) -------------------------------------------------
function VouchFeedCard({ vouch }: { vouch: FeedVouch }) {
  const pill = VOUCH_PILL[vouch.vouch_type] ?? VOUCH_PILL.do!;
  const who = vouch.author?.display_name ?? vouch.author?.handle ?? 'Someone';
  const reason = `${who} vouched · ${vouch.destination_text}`;
  const recordInteraction = useRecordInteraction();

  // Outbound "act on it" — mirrors the plan-screen / list-detail pattern.
  // Acting on a circle vouch is a revealed-trust signal we learn from
  // (migration 51); the feed only ever shows OTHER authors' vouches, so every
  // card is a non-own vouch worth recording. Fire-and-forget.
  const openMaps = () => {
    recordInteraction.mutate({ vouchId: vouch.id, kind: 'maps' });
    // Lead phrase before the first dash/comma is usually the venue name; pair
    // it with the destination so Maps lands on the right place.
    const lead = vouch.text.split(/[—–\-,.]/)[0]?.trim() || vouch.text;
    const query = encodeURIComponent(`${lead}, ${vouch.destination_text}`);
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`).catch((err) =>
      log.error('open maps failed', err),
    );
  };
  const shareVouch = () => {
    recordInteraction.mutate({ vouchId: vouch.id, kind: 'share' });
    Share.share({
      message: `"${vouch.text}" — ${who} vouched · ${vouch.destination_text}`,
    }).catch((err) => log.error('share vouch failed', err));
  };

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
          <View style={[styles.catPill, { backgroundColor: pill.bg, marginLeft: 'auto' }]}>
            <Text style={[styles.catPillLabel, { color: pill.fg }]}>{pill.label}</Text>
          </View>
        </View>
        <Text style={styles.cardQuote} numberOfLines={4}>
          "{vouch.text}"
        </Text>
        <Text style={styles.vouchReason}>{reason.toUpperCase()}</Text>
        <View style={styles.vouchActions}>
          {VOUCH_PLACE_TYPES.has(vouch.vouch_type) ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open in Maps"
              onPress={openMaps}
              hitSlop={12}
              style={styles.vouchActionBtn}
            >
              <Text style={styles.vouchActionLabel}>↗ Maps</Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Share this vouch"
            onPress={shareVouch}
            hitSlop={12}
            style={styles.vouchActionBtn}
          >
            <Text style={styles.vouchActionLabel}>Share</Text>
          </Pressable>
        </View>
      </View>
    </View>
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
  savedCount: { fontFamily: 'DMSans_600SemiBold', fontSize: 13, color: MUTE },

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
  emptyCtaSecondary: {
    marginTop: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  emptyCtaSecondaryLabel: { fontFamily: 'DMSans_600SemiBold', fontSize: 15, color: CORAL },

  // 1. Payoff banner — someone saved your vouch. The return hook, top of home.
  payoffBanner: {
    backgroundColor: '#FFF3EF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F6D9CF',
    padding: 16,
    gap: 12,
  },
  payoffRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  payoffText: {
    flex: 1,
    fontFamily: 'DMSans_400Regular',
    fontSize: 13.5,
    lineHeight: 19,
    color: INK,
  },
  payoffWho: { fontFamily: 'DMSans_600SemiBold', color: INK },

  // 2. Intent-desk supply line — leads the active home. A quiet prompt + a
  // small log CTA, so home reads as "what can I do" before "what's new".
  supplyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: CARD,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: HAIR,
    padding: 16,
  },
  supplyTitle: {
    fontFamily: 'PlayfairDisplay_500Medium',
    fontSize: 18,
    color: INK,
    letterSpacing: -0.3,
  },
  supplyBody: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12.5,
    lineHeight: 18,
    color: MUTE,
    marginTop: 4,
  },
  supplyCta: {
    backgroundColor: CORAL,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  supplyCtaLabel: { fontFamily: 'DMSans_600SemiBold', fontSize: 14, color: '#FFFFFF' },

  // 3. Resurfacing "See all" footer link.
  seeAllRow: { paddingVertical: 4 },
  seeAllLabel: { fontFamily: 'DMSans_600SemiBold', fontSize: 13.5, color: CORAL },

  // 4. Liveness line — small momentum signal.
  livenessLine: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 13,
    color: MUTE,
  },

  // 6. Belonging nudge — quiet, bottom. Belonging, never points.
  belongingLine: {
    fontFamily: 'PlayfairDisplay_500Medium_Italic',
    fontSize: 14.5,
    lineHeight: 21,
    color: MUTE,
  },

  // Section eyebrow
  eyebrow: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 11,
    letterSpacing: 1.6,
    color: FAINT,
    textTransform: 'uppercase',
    marginBottom: 12,
  },

  // Vouch card (Lately feed + resurfacing)
  card: {
    backgroundColor: CARD,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: HAIR,
  },
  catPill: {
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
  cardQuote: {
    // Italic — this is a pull-quote ("Order the hand drip..."), the one
    // place on the card where italic Playfair is the right voice.
    fontFamily: 'PlayfairDisplay_500Medium_Italic',
    fontSize: 15,
    lineHeight: 21,
    color: MUTE,
    marginTop: 12,
  },
  vouchReason: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 10,
    letterSpacing: 1,
    color: FAINT,
    marginTop: 12,
  },
  // Act-on-it row on circle vouch cards — Maps (place types) + Share.
  vouchActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  vouchActionBtn: {
    borderWidth: 1,
    borderColor: HAIR,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  vouchActionLabel: { fontFamily: 'DMSans_600SemiBold', fontSize: 13, color: INK },

  caughtUp: {
    // Italic — "you're all caught up" is a tonal sign-off, not a title.
    fontFamily: 'PlayfairDisplay_500Medium_Italic',
    fontSize: 13.5,
    color: FAINT,
    textAlign: 'center',
    paddingVertical: 24,
  },
});
