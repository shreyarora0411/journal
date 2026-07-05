import { Eyebrow, Face, Page, StatusSpace, VoicedNote } from '@/components';
import { useAuthStore } from '@/features/auth';
import { buildPersonalInviteText } from '@/features/invite';
import { log } from '@/lib/log';
import { hubLabel } from '@journal/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Linking, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { usePlaceDetail } from '../api/use-taste-data';
import { LoadError } from '../components/LoadError';
import {
  CARD,
  CORAL,
  HAIR,
  INK,
  MUTE,
  SANS,
  SANS_BOLD,
  SANS_SEMI,
  SERIF,
  TASTE_TYPE_SCALE,
} from '../lib/taste-tokens';

/**
 * Spot — the place page (spec §3, screen 5). Who in your taste-orbit loved it,
 * their words, and Open in Maps. Attribution is loves-only by design.
 */
const MY_SENTIMENT_LINE: Record<string, string> = {
  loved: 'On your map — loved.',
  fine: 'You logged this as fine.',
  skip: 'You skipped this — only you ever see that.',
};

const mapsUrl = (p: { name: string; google_place_id: string }) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.name)}&query_place_id=${p.google_place_id}`;

export function SpotScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = usePlaceDetail(id ?? null);
  const viewerId = useAuthStore((s) => s.session?.user.id ?? null);

  const place = q.data?.place ?? null;
  const lovers = q.data?.lovers ?? [];
  const mine = q.data?.mine ?? null;

  const openMaps = () => {
    if (!place) return;
    log.event('taste.maps_opened', { place_id: place.id, from: 'spot' });
    Linking.openURL(mapsUrl(place)).catch(() => undefined);
  };

  // Whatever voiced note is already on this page — your own take first (it's
  // yours to share), else the top love — so the share never invents a quote.
  const shareSpot = () => {
    if (!place) return;
    log.event('taste.place_shared', { place_id: place.id, from: 'spot' });
    const note = mine?.note ?? lovers[0]?.note ?? null;
    const message = [
      place.name,
      note ? `"${note}"` : null,
      mapsUrl(place),
      buildPersonalInviteText(viewerId),
    ]
      .filter((line): line is string => Boolean(line))
      .join('\n\n');
    Share.share({ message }).catch(() => undefined);
  };

  return (
    <Page>
      <StatusSpace />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        onPress={() => router.back()}
        hitSlop={12}
      >
        <Text style={styles.back}>‹ Back</Text>
      </Pressable>

      {q.isLoading ? (
        <Text style={styles.empty}>Loading…</Text>
      ) : q.isError ? (
        <LoadError message="Couldn't load this place." onRetry={() => q.refetch()} />
      ) : !place ? (
        <Text style={styles.empty}>Place not found.</Text>
      ) : (
        <>
          <Text style={styles.name}>{place.name}</Text>
          <Text style={styles.meta}>
            {[hubLabel(place.hub), place.zone, place.destination_text]
              .filter(
                (part, i, all): part is string =>
                  Boolean(part) &&
                  all.findIndex((p) => p?.toLowerCase() === part?.toLowerCase()) === i,
              )
              .join(' · ')
              .toUpperCase()}
          </Text>

          <View style={styles.actionRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Open ${place.name} in Maps`}
              onPress={openMaps}
              style={styles.mapsBtn}
            >
              <Text style={styles.mapsLabel}>Open in Maps</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Share ${place.name}`}
              onPress={shareSpot}
              style={styles.mapsBtn}
            >
              <Text style={styles.mapsLabel}>Share</Text>
            </Pressable>
          </View>

          {mine ? (
            <View style={{ marginTop: 28 }}>
              <Eyebrow>Your take</Eyebrow>
              <View style={styles.mineCard}>
                <Text style={styles.mineSentiment}>{MY_SENTIMENT_LINE[mine.sentiment]}</Text>
                {mine.note ? <VoicedNote note={mine.note} size="lg" /> : null}
              </View>
            </View>
          ) : null}

          <View style={{ marginTop: 28, marginBottom: 80 }}>
            <Eyebrow>Who loved it</Eyebrow>
            {lovers.length === 0 ? (
              <Text style={styles.empty}>No loves in your orbit yet — if you know it, log it.</Text>
            ) : (
              <View style={{ gap: 10, marginTop: 12 }}>
                {lovers.map((l) => {
                  const who = l.display_name ?? l.handle ?? 'Someone';
                  return (
                    <Pressable
                      key={l.user_id}
                      accessibilityRole="button"
                      accessibilityLabel={`Open ${who}'s map`}
                      onPress={() => router.push(`/(tabs)/person/${l.user_id}` as never)}
                      style={styles.loverCard}
                    >
                      <View style={styles.loverHead}>
                        <Face
                          uri={l.avatar_url}
                          initials={who.slice(0, 2).toUpperCase()}
                          size="sm"
                        />
                        <Text style={styles.loverName}>
                          {who}
                          {l.match != null ? (
                            <Text style={styles.loverMatch}>
                              {'  '}
                              {Math.round(l.match * 100)}% overlap
                            </Text>
                          ) : null}
                        </Text>
                      </View>
                      {l.note ? <VoicedNote note={l.note} size="lg" /> : null}
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
        </>
      )}
    </Page>
  );
}

const styles = StyleSheet.create({
  back: { fontFamily: SANS_SEMI, fontSize: TASTE_TYPE_SCALE.subhead, color: MUTE, marginTop: 4 },
  name: {
    fontFamily: SERIF,
    fontSize: 32,
    lineHeight: 38,
    color: INK,
    letterSpacing: -0.7,
    marginTop: 10,
  },
  meta: {
    fontFamily: SANS_BOLD,
    fontSize: TASTE_TYPE_SCALE.caption,
    letterSpacing: 0.8,
    color: MUTE,
    marginTop: 6,
  },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  mapsBtn: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: HAIR,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 9,
    backgroundColor: '#FFFFFF',
  },
  mapsLabel: { fontFamily: SANS_SEMI, fontSize: TASTE_TYPE_SCALE.body, color: INK },
  empty: { fontFamily: SANS, fontSize: TASTE_TYPE_SCALE.body, color: MUTE, marginTop: 16 },
  loverCard: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: HAIR,
    backgroundColor: CARD,
    gap: 8,
  },
  mineCard: {
    marginTop: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: HAIR,
    backgroundColor: CARD,
    gap: 8,
  },
  mineSentiment: { fontFamily: SANS_SEMI, fontSize: 12.5, color: MUTE },
  loverHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  loverName: { fontFamily: SANS_SEMI, fontSize: TASTE_TYPE_SCALE.subhead, color: INK },
  loverMatch: { fontFamily: SANS_BOLD, fontSize: TASTE_TYPE_SCALE.label, color: CORAL },
});
