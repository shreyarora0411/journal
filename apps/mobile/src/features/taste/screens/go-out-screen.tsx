import { Face, Page, StatusSpace, VoicedNote } from '@/components';
import { useAuthStore } from '@/features/auth';
import { buildPersonalInviteText } from '@/features/invite';
import { log } from '@/lib/log';
import { DELHI_HUBS, GURGAON_HUBS, OCCASION_TAGS, hubLabel } from '@journal/shared';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { type RecommendedPlace, useRecommendPlaces } from '../api/use-taste-data';
import { LoadError } from '../components/LoadError';
import {
  CARD,
  CORAL,
  CORAL_TEXT,
  HAIR,
  INK,
  MUTE,
  SANS,
  SANS_BOLD,
  SANS_SEMI,
  SERIF,
  TASTE_TYPE_SCALE,
  TINT,
} from '../lib/taste-tokens';

const TIER_LINE: Record<RecommendedPlace['tier'], string> = {
  taste: 'People who go out like you',
  follows: 'People you follow',
  tribe: 'Loved by the tribe',
};

const mapsUrl = (p: RecommendedPlace) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.name)}&query_place_id=${p.google_place_id}`;

const excerpt = (s: string, max = 60) => (s.length > max ? `${s.slice(0, max).trim()}…` : s);

// The card's own accessibilityLabel used to be "Open ${p.name}", which (since
// the card is one accessible Pressable) replaced every child Text for screen
// readers — silently dropping the tier, the friend, the match%, and the note.
// Compose the same information here instead of letting it go dark.
const cardAccessibilityLabel = (p: RecommendedPlace) => {
  const top = p.top_lovers[0];
  const who = top ? (top.display_name ?? top.handle ?? 'Someone') : null;
  const match = top?.match != null ? `${Math.round(top.match * 100)}% overlap` : null;
  const note = top?.note ? `"${excerpt(top.note)}"` : null;
  return [p.name, TIER_LINE[p.tier], who, match, note].filter(Boolean).join(', ');
};

/**
 * Go out — the demand payoff (spec §3, screen 3). Query = hub + occasion;
 * results are taste-ranked with HONEST, labeled tiers ('people who go out like
 * you' / 'people you follow' / 'the tribe' — never a fabricated match), each
 * carrying WHO + their voiced note + Open in Maps.
 * NCR rule: "area" = named hub chips, never GPS radius; zone shown on cards.
 */
export function GoOutScreen() {
  const router = useRouter();
  const [zone, setZone] = useState<'gurgaon' | 'delhi'>('gurgaon');
  const [hub, setHub] = useState<string | null>(null);
  const [occasion, setOccasion] = useState<string | null>(null);
  const q = useRecommendPlaces(zone, hub, occasion);
  const viewerId = useAuthStore((s) => s.session?.user.id ?? null);

  useEffect(() => {
    log.event('taste.go_out_entered');
  }, []);

  const hubs = zone === 'gurgaon' ? GURGAON_HUBS : DELHI_HUBS;
  const results = q.data ?? [];

  const openMaps = (p: RecommendedPlace) => {
    log.event('taste.maps_opened', { place_id: p.place_id, from: 'goout' });
    Linking.openURL(mapsUrl(p)).catch(() => undefined);
  };

  // Top voiced note already on the card — never invent a quote for the share.
  const shareSpot = (p: RecommendedPlace) => {
    log.event('taste.place_shared', { place_id: p.place_id, from: 'goout' });
    const note = p.top_lovers[0]?.note ?? null;
    const message = [
      p.name,
      note ? `"${note}"` : null,
      mapsUrl(p),
      buildPersonalInviteText(viewerId),
    ]
      .filter((line): line is string => Boolean(line))
      .join('\n\n');
    Share.share({ message }).catch(() => undefined);
  };

  return (
    <Page>
      <StatusSpace />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
        <Text style={styles.headline}>Where tonight?</Text>

        {/* Zone toggle — one graph, two zones (Gurgaon first). */}
        <View style={styles.zoneRow}>
          {(['gurgaon', 'delhi'] as const).map((z) => (
            <Pressable
              key={z}
              accessibilityRole="button"
              accessibilityLabel={z === 'gurgaon' ? 'Gurgaon' : 'Delhi'}
              accessibilityState={{ selected: zone === z }}
              onPress={() => {
                setZone(z);
                setHub(null);
              }}
              hitSlop={{ top: 6, bottom: 6 }}
              style={[styles.zoneChip, zone === z && styles.zoneChipOn]}
            >
              <Text style={[styles.zoneLabel, zone === z && styles.zoneLabelOn]}>
                {z === 'gurgaon' ? 'Gurgaon' : 'Delhi'}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Hub chips — how NCR actually decides ("CyberHub or 32nd?"). */}
        <Text style={styles.sectionEyebrow}>Where</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Anywhere"
              accessibilityState={{ selected: hub === null }}
              onPress={() => setHub(null)}
              hitSlop={{ top: 6, bottom: 6 }}
              style={[styles.chip, hub === null && styles.chipOn]}
            >
              <Text style={[styles.chipLabel, hub === null && styles.chipLabelOn]}>Anywhere</Text>
            </Pressable>
            {hubs.map((h) => (
              <Pressable
                key={h.slug}
                accessibilityRole="button"
                accessibilityLabel={h.label}
                accessibilityState={{ selected: hub === h.slug }}
                onPress={() => setHub(hub === h.slug ? null : h.slug)}
                hitSlop={{ top: 6, bottom: 6 }}
                style={[styles.chip, hub === h.slug && styles.chipOn]}
              >
                <Text style={[styles.chipLabel, hub === h.slug && styles.chipLabelOn]}>
                  {h.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        {/* Occasion chips — gate the query by the need you're in right now. */}
        <Text style={[styles.sectionEyebrow, { marginTop: 16 }]}>Occasion</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {OCCASION_TAGS.map((o) => (
              <Pressable
                key={o.slug}
                accessibilityRole="button"
                accessibilityLabel={o.label}
                accessibilityState={{ selected: occasion === o.slug }}
                onPress={() => setOccasion(occasion === o.slug ? null : o.slug)}
                hitSlop={{ top: 6, bottom: 6 }}
                style={[styles.chipSoft, occasion === o.slug && styles.chipOn]}
              >
                <Text style={[styles.chipLabel, occasion === o.slug && styles.chipLabelOn]}>
                  {o.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        {/* Results — honest tiers, who + why, act-on-it. An error is an
            error; "nothing loved here" is reserved for a real empty. */}
        {q.isLoading ? (
          <Text style={styles.empty}>Finding your places…</Text>
        ) : q.isError ? (
          <LoadError message="Couldn't load spots." onRetry={() => q.refetch()} />
        ) : results.length === 0 ? (
          <View style={styles.emptyCard}>
            {occasion ? (
              <>
                <Text style={styles.emptyTitle}>
                  Nothing tagged “{OCCASION_TAGS.find((o) => o.slug === occasion)?.label}” yet.
                </Text>
                <Text style={styles.emptyBody}>
                  Loved places show up here once someone tags them for this occasion — add the tag
                  when you log.
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.emptyTitle}>Nothing loved here yet.</Text>
                <Text style={styles.emptyBody}>
                  No one else has loved a spot {hub ? 'in this hub' : 'here'} yet — be the first to
                  put one on the map.
                </Text>
              </>
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Log a place"
              onPress={() => router.push('/(tabs)/add' as never)}
              hitSlop={8}
            >
              <Text style={styles.emptyCta}>Log a place ›</Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ marginTop: 20, gap: 12 }}>
            {results.map((p) => (
              <Pressable
                key={p.place_id}
                accessibilityRole="button"
                accessibilityLabel={cardAccessibilityLabel(p)}
                onPress={() => router.push(`/(tabs)/spot/${p.place_id}` as never)}
                style={styles.card}
              >
                <View style={styles.cardHead}>
                  <Text style={styles.cardName} numberOfLines={1}>
                    {p.name}
                  </Text>
                  <Text style={styles.cardHub}>
                    {[hubLabel(p.hub), p.zone].filter(Boolean).join(' · ').toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.tierLine}>{TIER_LINE[p.tier]}</Text>
                {p.top_lovers.slice(0, 2).map((l) => {
                  const who = l.display_name ?? l.handle ?? 'Someone';
                  return (
                    <View key={l.user_id} style={styles.loverRow}>
                      <Face uri={l.avatar_url} initials={who.slice(0, 2).toUpperCase()} size="sm" />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.loverName}>
                          {who}
                          {l.match != null ? (
                            <Text style={styles.loverMatch}>
                              {'  '}
                              {Math.round(l.match * 100)}% overlap
                            </Text>
                          ) : null}
                        </Text>
                        {l.note ? (
                          <VoicedNote note={l.note} numberOfLines={2} style={styles.loverNote} />
                        ) : null}
                      </View>
                    </View>
                  );
                })}
                <View style={styles.cardActions}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Open ${p.name} in Maps`}
                    onPress={() => openMaps(p)}
                    hitSlop={12}
                    style={styles.actionBtn}
                  >
                    <Text style={styles.actionLabel}>Open in Maps</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Share ${p.name}`}
                    onPress={() => shareSpot(p)}
                    hitSlop={12}
                    style={styles.actionBtn}
                  >
                    <Text style={styles.actionLabel}>Share</Text>
                  </Pressable>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </Page>
  );
}

const styles = StyleSheet.create({
  headline: {
    fontFamily: SERIF,
    fontSize: 30,
    color: INK,
    letterSpacing: -0.6,
    paddingTop: 8,
  },
  zoneRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  // Labels the "where" (hub) vs "what kind of night" (occasion) rails so the
  // filter stack above the first result reads as two questions, not one
  // undifferentiated wall of chips — matches taste-setup-screen's hubHeader.
  sectionEyebrow: {
    fontFamily: SANS_BOLD,
    fontSize: TASTE_TYPE_SCALE.micro,
    letterSpacing: 0.8,
    color: MUTE,
    textTransform: 'uppercase',
    marginTop: 20,
  },
  zoneChip: {
    borderWidth: 1,
    borderColor: HAIR,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
  },
  zoneChipOn: { backgroundColor: INK, borderColor: INK },
  zoneLabel: { fontFamily: SANS_SEMI, fontSize: TASTE_TYPE_SCALE.subhead, color: MUTE },
  zoneLabelOn: { color: '#FFFFFF' },
  chip: {
    borderWidth: 1,
    borderColor: HAIR,
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 7,
    backgroundColor: '#FFFFFF',
  },
  chipSoft: {
    borderWidth: 1,
    borderColor: HAIR,
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 7,
    backgroundColor: TINT,
  },
  chipOn: { backgroundColor: CORAL, borderColor: CORAL },
  chipLabel: { fontFamily: SANS_SEMI, fontSize: TASTE_TYPE_SCALE.body, color: INK },
  chipLabelOn: { color: '#FFFFFF' },
  empty: { fontFamily: SANS, fontSize: TASTE_TYPE_SCALE.body, color: MUTE, marginTop: 24 },
  emptyCard: {
    marginTop: 20,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: HAIR,
    backgroundColor: CARD,
  },
  emptyTitle: {
    fontFamily: SERIF,
    fontSize: TASTE_TYPE_SCALE.headlineLg,
    color: INK,
    letterSpacing: -0.4,
  },
  emptyBody: {
    fontFamily: SANS,
    fontSize: TASTE_TYPE_SCALE.body,
    lineHeight: 20,
    color: MUTE,
    marginTop: 8,
  },
  emptyCta: {
    fontFamily: SANS_SEMI,
    fontSize: TASTE_TYPE_SCALE.subhead,
    color: CORAL,
    marginTop: 14,
  },
  card: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: HAIR,
    backgroundColor: CARD,
    gap: 10,
  },
  cardHead: { gap: 3 },
  cardName: { fontFamily: SERIF, fontSize: 20, color: INK, letterSpacing: -0.3 },
  cardHub: { fontFamily: SANS_BOLD, fontSize: 10.5, letterSpacing: 0.8, color: INK },
  tierLine: {
    fontFamily: SANS_BOLD,
    fontSize: 10.5,
    letterSpacing: 1,
    color: MUTE,
    textTransform: 'uppercase',
  },
  loverRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  loverName: { fontFamily: SANS_SEMI, fontSize: 13.5, color: INK },
  loverMatch: { fontFamily: SANS_BOLD, fontSize: TASTE_TYPE_SCALE.label, color: CORAL_TEXT },
  loverNote: { marginTop: 3 },
  cardActions: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    borderWidth: 1,
    borderColor: HAIR,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#FFFFFF',
  },
  actionLabel: { fontFamily: SANS_SEMI, fontSize: TASTE_TYPE_SCALE.label, color: INK },
});
