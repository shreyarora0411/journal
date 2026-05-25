import { CategoryPill, Face, FaceStack, Photo, PullQuote } from '@/components';
import { type FriendRec, getDestination, recsForDestination } from '@/features/feed/lib/fixtures';
import { useGetPhoneForFriend } from '@/features/follows';
import { useWishlistRows } from '@/features/wishlist';
import { useTogglePlan } from '@/features/wishlist';
import { useToast } from '@/hooks/use-toast';
import { log } from '@/lib/log';
import { CATEGORIES, type Category } from '@/theme';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const CORAL = '#FF4D2E';
const INK = '#1A1410';
const MUTE = '#7A716A';
const TINT = '#FAF6F0';
const HAIR = '#EFEAE2';

/**
 * Destination (#09 of the redesign — Batch B).
 *
 * Full-bleed hero (320pt) with floating back/share/heart pills, title in
 * 56pt italic serif, relational context line ("Tara is here now…"),
 * coral "Ping Tara" CTA, tinted "+ Plan", category filter pills, and the
 * vertical list of recommendation cards.
 */
type CategoryFilter = Category | 'all';

const CATEGORY_ORDER: ReadonlyArray<CategoryFilter> = [
  'all',
  'stay',
  'food',
  'drinks',
  'wander',
  'buy',
];

export function DestinationScreen() {
  const router = useRouter();
  const toast = useToast();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<CategoryFilter>('all');
  const togglePlan = useTogglePlan();
  const getPhone = useGetPhoneForFriend();
  const wishlist = useWishlistRows();

  const dest = useMemo(() => getDestination(slug ?? ''), [slug]);
  const allRecs = useMemo(() => recsForDestination(slug ?? ''), [slug]);
  const recs = useMemo(
    () => (filter === 'all' ? allRecs : allRecs.filter((r) => r.category === filter)),
    [allRecs, filter],
  );
  // Use the slug as the destination's stable external identifier for
  // wishlist purposes — fixtures don't carry Google Place IDs yet.
  const isPlanned = (wishlist.data ?? []).some(
    (w) => w.parent_wishlist_item_id === null && w.target_external_id === (slug ?? ''),
  );

  useEffect(() => {
    log.event('destination.screen_entered', { slug });
  }, [slug]);

  const onPing = async () => {
    const first = dest?.friends[0];
    if (!first) return;
    // Fixture friend IDs (`f-tara`) won't resolve to a real auth user,
    // so the RPC returns null. Surface a useful toast in that case.
    const phone = await getPhone.mutateAsync(first.id).catch(() => null);
    if (!phone) {
      toast.show({
        message: `You'll need to follow each other before you can ping ${first.name}.`,
        variant: 'info',
      });
      return;
    }
    const text = `hey, you were in ${dest?.name ?? 'there'} recently? planning a trip, anything I should know?`;
    const url = `whatsapp://send?phone=${encodeURIComponent(phone)}&text=${encodeURIComponent(text)}`;
    const canOpen = await Linking.canOpenURL(url).catch(() => false);
    if (!canOpen) {
      toast.show({ message: 'WhatsApp not installed on this device.', variant: 'info' });
      return;
    }
    await Linking.openURL(url);
  };

  const onTogglePlan = async () => {
    if (!dest || !slug) return;
    try {
      const result = await togglePlan.mutateAsync({
        externalId: slug,
        label: dest.name,
      });
      toast.show({
        message: result.added ? `Added ${dest.name} to your plan` : 'Removed from plan',
        variant: 'success',
      });
    } catch (err) {
      log.error('toggle plan failed', err);
      toast.show({ message: 'Could not update plan. Try again.', variant: 'error' });
    }
  };

  if (!dest) {
    return (
      <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
        <Text style={{ padding: 24, color: MUTE }}>Destination not found.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#FFFFFF' }}
      contentContainerStyle={{ paddingBottom: 96 }}
    >
      {/* Full-bleed hero */}
      <View style={{ height: 320 }}>
        <Image
          source={{ uri: dest.heroUri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          accessibilityIgnoresInvertColors
        />
        {/* Top action pills */}
        <View style={[styles.actionRow, { top: insets.top + 8 }]}>
          <ActionPill glyph="‹" label="Back" onPress={() => router.back()} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <ActionPill glyph="↗" label="Share" onPress={() => undefined} />
            <ActionPill glyph="♡" label="Heart" onPress={() => undefined} />
          </View>
        </View>
      </View>

      {/* Title block */}
      <View style={{ paddingHorizontal: 22, paddingTop: 20 }}>
        <Text style={styles.title}>{dest.name}</Text>
        <Text style={styles.country}>{dest.country}</Text>
      </View>

      {/* Relational context */}
      <View style={styles.contextBlock}>
        <FaceStack
          people={dest.friends.slice(0, 5).map((f) => ({
            uri: f.avatarUri,
            initials: f.name.slice(0, 2),
          }))}
          max={5}
          size="md"
        />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={styles.contextCue}>
            {dest.friends.length} friends · {dest.placeCount} places
          </Text>
          {/* `dest.cue` (e.g. "Tara is here now") removed in Session 2
              — no current_trip system to back it. Will return as a real
              live-status surface later. */}
        </View>
      </View>

      {/* CTAs */}
      <View style={styles.ctaRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Ping ${dest.friends[0]?.name}`}
          onPress={onPing}
          disabled={getPhone.isPending}
          style={styles.ctaPrimary}
        >
          <Text style={styles.ctaPrimaryLabel}>
            {getPhone.isPending ? 'Opening…' : `Ping ${dest.friends[0]?.name} →`}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isPlanned ? 'Remove from plan' : 'Add to plan'}
          onPress={onTogglePlan}
          disabled={togglePlan.isPending}
          style={[styles.ctaGhost, isPlanned ? styles.ctaGhostOn : null]}
        >
          <Text style={[styles.ctaGhostLabel, isPlanned ? { color: '#FFFFFF' } : null]}>
            {isPlanned ? 'Planned ✓' : '+ Plan'}
          </Text>
        </Pressable>
      </View>

      {/* Category filter pills */}
      <View style={styles.filterRow}>
        {CATEGORY_ORDER.map((c) => (
          <FilterPill
            key={c}
            category={c}
            active={c === filter}
            count={c === 'all' ? allRecs.length : allRecs.filter((r) => r.category === c).length}
            onPress={() => setFilter(c)}
          />
        ))}
      </View>

      {/* Rec cards */}
      <View style={{ gap: 14, paddingHorizontal: 22, marginTop: 16 }}>
        {recs.map((r) => (
          <DestRecCard
            key={r.id}
            rec={r}
            onPress={() => router.push('/(tabs)/place/hotel-k5' as never)}
          />
        ))}
        {recs.length === 0 ? (
          <Text style={{ color: MUTE, fontFamily: 'Geist_400Regular', fontSize: 14 }}>
            No friend recs in this category yet.
          </Text>
        ) : null}
      </View>
    </ScrollView>
  );
}

function ActionPill({
  glyph,
  label,
  onPress,
}: { glyph: string; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={styles.actionPill}
    >
      <Text style={styles.actionGlyph}>{glyph}</Text>
    </Pressable>
  );
}

function FilterPill({
  category,
  active,
  count,
  onPress,
}: {
  category: CategoryFilter;
  active: boolean;
  count: number;
  onPress: () => void;
}) {
  const label = category === 'all' ? `All ${count}` : `${CATEGORIES[category].label} ${count}`;
  const accent = category === 'all' ? CORAL : CATEGORIES[category].color;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[
        styles.filterPill,
        active
          ? { backgroundColor: accent, borderColor: accent }
          : { backgroundColor: 'transparent', borderColor: HAIR },
      ]}
    >
      {!active ? <View style={[styles.filterDot, { backgroundColor: accent }]} /> : null}
      <Text style={[styles.filterLabel, { color: active ? '#FFFFFF' : INK }]}>{label}</Text>
    </Pressable>
  );
}

function DestRecCard({ rec, onPress }: { rec: FriendRec; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${rec.placeName}, ${rec.friend.name}'s rec`}
      onPress={onPress}
      style={styles.destCard}
    >
      <Photo uri={rec.coverUri} aspectRatio={5 / 3} radius={14}>
        <View style={{ position: 'absolute', top: 10, left: 10 }}>
          <CategoryPill category={rec.category} variant="soft" />
        </View>
        <View style={styles.miniChip}>
          <Face uri={rec.friend.avatarUri} size="xs" />
          <Text style={styles.miniChipLabel}>
            {rec.friend.name} · {rec.when}
          </Text>
        </View>
      </Photo>
      <View style={{ marginTop: 10 }}>
        <Text style={styles.cardPlaceName}>{rec.placeName}</Text>
        <Text style={styles.cardArea}>{rec.area}</Text>
        <PullQuote size="sm">{rec.quote}</PullQuote>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  actionRow: {
    position: 'absolute',
    left: 22,
    right: 22,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionPill: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionGlyph: { fontSize: 18, color: INK, fontFamily: 'InstrumentSerif_400Italic' },
  title: {
    fontFamily: 'InstrumentSerif_400Italic',
    fontSize: 56,
    lineHeight: 60,
    color: INK,
    letterSpacing: -1.6,
  },
  country: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 11,
    letterSpacing: 1.4,
    color: MUTE,
    marginTop: 4,
  },
  contextBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 22,
    marginTop: 16,
  },
  contextCue: { fontFamily: 'Geist_500Medium', fontSize: 13, color: INK },
  contextLine: { fontFamily: 'Geist_400Regular', fontSize: 13, color: MUTE, lineHeight: 18 },
  ctaRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 22, marginTop: 16 },
  ctaPrimary: {
    flex: 1,
    backgroundColor: CORAL,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
  },
  ctaPrimaryLabel: { fontFamily: 'Geist_500Medium', fontSize: 15, color: '#FFFFFF' },
  ctaGhost: {
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: TINT,
  },
  ctaGhostOn: {
    backgroundColor: CORAL,
  },
  ctaGhostLabel: { fontFamily: 'Geist_500Medium', fontSize: 15, color: INK },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 22,
    marginTop: 24,
    flexWrap: 'wrap',
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  filterDot: { width: 6, height: 6, borderRadius: 3 },
  filterLabel: { fontFamily: 'Geist_500Medium', fontSize: 12 },
  destCard: {
    backgroundColor: '#FFFFFF',
    borderColor: HAIR,
    borderWidth: 1,
    borderRadius: 18,
    padding: 12,
  },
  miniChip: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  miniChipLabel: { fontFamily: 'Geist_500Medium', fontSize: 11, color: INK },
  cardPlaceName: { fontFamily: 'Geist_500Medium', fontSize: 16, color: INK },
  cardArea: { fontFamily: 'Geist_400Regular', fontSize: 12, color: MUTE, marginTop: 2 },
});
