import { Face, Page, StatusSpace } from '@/components';
import { log } from '@/lib/log';
import { DELHI_HUBS, GURGAON_HUBS, OCCASION_TAGS, hubLabel } from '@journal/shared';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { type RecommendedPlace, useRecommendPlaces } from '../api/use-taste-data';
import { LoadError } from '../components/LoadError';

const CORAL = '#FF4D2E';
const INK = '#1B1714';
const MUTE = '#8A8178';
const HAIR = '#E7E1D7';
const CARD = '#FFFDFA';
const TINT = '#FAF6F0';

const SERIF = 'Fraunces_500';
const SERIF_IT = 'Fraunces_400Italic';
const SANS = 'HankenGrotesk_400Regular';
const SANS_SEMI = 'HankenGrotesk_600SemiBold';
const SANS_BOLD = 'HankenGrotesk_700Bold';

const TIER_LINE: Record<RecommendedPlace['tier'], string> = {
  taste: 'People who go out like you',
  follows: 'People you follow',
  tribe: 'Loved by the tribe',
};

const mapsUrl = (p: RecommendedPlace) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.name)}&query_place_id=${p.google_place_id}`;

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

  useEffect(() => {
    log.event('taste.go_out_entered');
  }, []);

  const hubs = zone === 'gurgaon' ? GURGAON_HUBS : DELHI_HUBS;
  const results = q.data ?? [];

  const openMaps = (p: RecommendedPlace) => {
    log.event('taste.maps_opened', { place_id: p.place_id, from: 'goout' });
    Linking.openURL(mapsUrl(p)).catch(() => undefined);
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
              style={[styles.zoneChip, zone === z && styles.zoneChipOn]}
            >
              <Text style={[styles.zoneLabel, zone === z && styles.zoneLabelOn]}>
                {z === 'gurgaon' ? 'Gurgaon' : 'Delhi'}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Hub chips — how NCR actually decides ("CyberHub or 32nd?"). */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Anywhere"
              accessibilityState={{ selected: hub === null }}
              onPress={() => setHub(null)}
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
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {OCCASION_TAGS.map((o) => (
              <Pressable
                key={o.slug}
                accessibilityRole="button"
                accessibilityLabel={o.label}
                accessibilityState={{ selected: occasion === o.slug }}
                onPress={() => setOccasion(occasion === o.slug ? null : o.slug)}
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
                accessibilityLabel={`Open ${p.name}`}
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
                          <Text style={styles.loverNote} numberOfLines={2}>
                            "{l.note}"
                          </Text>
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
  zoneChip: {
    borderWidth: 1,
    borderColor: HAIR,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
  },
  zoneChipOn: { backgroundColor: INK, borderColor: INK },
  zoneLabel: { fontFamily: SANS_SEMI, fontSize: 14, color: MUTE },
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
  chipLabel: { fontFamily: SANS_SEMI, fontSize: 13, color: INK },
  chipLabelOn: { color: '#FFFFFF' },
  empty: { fontFamily: SANS, fontSize: 13, color: MUTE, marginTop: 24 },
  emptyCard: {
    marginTop: 20,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: HAIR,
    backgroundColor: CARD,
  },
  emptyTitle: { fontFamily: SERIF, fontSize: 22, color: INK, letterSpacing: -0.4 },
  emptyBody: { fontFamily: SANS, fontSize: 13, lineHeight: 20, color: MUTE, marginTop: 8 },
  emptyCta: { fontFamily: SANS_SEMI, fontSize: 14, color: CORAL, marginTop: 14 },
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
    color: CORAL,
    textTransform: 'uppercase',
  },
  loverRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  loverName: { fontFamily: SANS_SEMI, fontSize: 13.5, color: INK },
  loverMatch: { fontFamily: SANS_BOLD, fontSize: 12, color: CORAL },
  loverNote: {
    fontFamily: SERIF_IT,
    fontSize: 14.5,
    lineHeight: 21,
    color: INK,
    marginTop: 3,
  },
  cardActions: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    borderWidth: 1,
    borderColor: HAIR,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#FFFFFF',
  },
  actionLabel: { fontFamily: SANS_SEMI, fontSize: 12, color: INK },
});
