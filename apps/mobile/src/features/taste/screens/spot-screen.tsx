import { Eyebrow, Face, Page, StatusSpace } from '@/components';
import { hubLabel } from '@journal/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { usePlaceDetail } from '../api/use-taste-data';
import { LoadError } from '../components/LoadError';

const CORAL = '#FF4D2E';
const INK = '#1B1714';
const MUTE = '#8A8178';
const HAIR = '#E7E1D7';
const CARD = '#FFFDFA';

const SERIF = 'Fraunces_500';
const SERIF_IT = 'Fraunces_400Italic';
const SANS = 'HankenGrotesk_400Regular';
const SANS_SEMI = 'HankenGrotesk_600SemiBold';
const SANS_BOLD = 'HankenGrotesk_700Bold';

/**
 * Spot — the place page (spec §3, screen 5). Who in your taste-orbit loved it,
 * their words, and Open in Maps. Attribution is loves-only by design.
 */
const MY_SENTIMENT_LINE: Record<string, string> = {
  loved: 'On your map — loved.',
  fine: 'You logged this as fine.',
  skip: 'You skipped this — only you ever see that.',
};

export function SpotScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = usePlaceDetail(id ?? null);

  const place = q.data?.place ?? null;
  const lovers = q.data?.lovers ?? [];
  const mine = q.data?.mine ?? null;

  const openMaps = () => {
    if (!place) return;
    Linking.openURL(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name)}&query_place_id=${place.google_place_id}`,
    ).catch(() => undefined);
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

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open ${place.name} in Maps`}
            onPress={openMaps}
            style={styles.mapsBtn}
          >
            <Text style={styles.mapsLabel}>Open in Maps</Text>
          </Pressable>

          {mine ? (
            <View style={{ marginTop: 28 }}>
              <Eyebrow>Your take</Eyebrow>
              <View style={styles.mineCard}>
                <Text style={styles.mineSentiment}>{MY_SENTIMENT_LINE[mine.sentiment]}</Text>
                {mine.note ? <Text style={styles.loverNote}>“{mine.note}”</Text> : null}
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
                      {l.note ? <Text style={styles.loverNote}>"{l.note}"</Text> : null}
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
  back: { fontFamily: SANS_SEMI, fontSize: 14, color: MUTE, marginTop: 4 },
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
    fontSize: 11,
    letterSpacing: 0.8,
    color: MUTE,
    marginTop: 6,
  },
  mapsBtn: {
    alignSelf: 'flex-start',
    marginTop: 16,
    borderWidth: 1,
    borderColor: HAIR,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 9,
    backgroundColor: '#FFFFFF',
  },
  mapsLabel: { fontFamily: SANS_SEMI, fontSize: 13, color: INK },
  empty: { fontFamily: SANS, fontSize: 13, color: MUTE, marginTop: 16 },
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
  loverName: { fontFamily: SANS_SEMI, fontSize: 14, color: INK },
  loverMatch: { fontFamily: SANS_BOLD, fontSize: 12, color: CORAL },
  loverNote: { fontFamily: SERIF_IT, fontSize: 15.5, lineHeight: 23, color: INK },
});
