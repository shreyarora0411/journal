import { Eyebrow, Face, Page, StatusSpace } from '@/components';
import { useAuthStore } from '@/features/auth';
import { useFollow, useFollowStatus, useUnfollow } from '@/features/follows';
import { TASTE_TUNING, hubLabel } from '@journal/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { usePersonMap } from '../api/use-person-map';
import { LoadError } from '../components/LoadError';

const CORAL = '#FF4D2E';
const INK = '#1B1714';
const MUTE = '#7A716A';
const HAIR = '#E7E1D7';
const CARD = '#FFFFFF';

const SERIF = 'Fraunces_500';
const SERIF_IT = 'Fraunces_400Italic';
const SANS = 'HankenGrotesk_400Regular';
const SANS_SEMI = 'HankenGrotesk_600SemiBold';
const SANS_BOLD = 'HankenGrotesk_700Bold';

/**
 * Person — a person AS a map (the anti-dating affordance). No bio, no photo
 * wall: their taste-overlap with you and the places they love, each of which
 * you can open and act on. Following means subscribing to this map.
 */
export function PersonScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const viewerId = useAuthStore((s) => s.session?.user.id ?? null);
  const q = usePersonMap(id ?? null);
  const followStatus = useFollowStatus(id ?? null);
  const follow = useFollow();
  const unfollow = useUnfollow();

  const person = q.data?.person ?? null;
  const places = q.data?.places ?? [];
  const match = q.data?.match ?? null;
  const isMe = Boolean(viewerId && id && viewerId === id);
  const who = person?.display_name ?? (person?.handle ? `@${person.handle}` : 'Someone');

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
        <LoadError message="Couldn't load this map." onRetry={() => q.refetch()} />
      ) : !person ? (
        <Text style={styles.empty}>Not found.</Text>
      ) : (
        <>
          <View style={styles.header}>
            <Face uri={person.avatar_url} initials={who.slice(0, 2).toUpperCase()} size="lg" />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.name} numberOfLines={1}>
                {who}
              </Text>
              {match != null ? (
                <Text style={styles.matchLine}>{Math.round(match * 100)}% taste overlap</Text>
              ) : !isMe ? (
                <Text style={styles.matchMuted}>
                  Taste overlap shows once you've both logged {TASTE_TUNING.confidenceMinLoves}{' '}
                  loves.
                </Text>
              ) : null}
            </View>
            {!isMe && id ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={followStatus.data ? `Unfollow ${who}` : `Follow ${who}'s map`}
                disabled={follow.isPending || unfollow.isPending}
                onPress={() => (followStatus.data ? unfollow.mutate(id) : follow.mutate(id))}
                style={[styles.followBtn, followStatus.data && styles.followBtnOn]}
              >
                <Text style={[styles.followLabel, followStatus.data && { color: MUTE }]}>
                  {followStatus.data ? 'Following' : 'Follow map'}
                </Text>
              </Pressable>
            ) : null}
          </View>

          <View style={{ marginTop: 26, marginBottom: 80 }}>
            <Eyebrow>{isMe ? 'Your loved places' : `Places ${who} loves`}</Eyebrow>
            {places.length === 0 ? (
              <Text style={styles.empty}>
                Nothing on this map yet{isMe ? ' — log a place you love.' : '.'}
              </Text>
            ) : (
              <View style={{ gap: 8, marginTop: 12 }}>
                {places.map((p) => (
                  <Pressable
                    key={p.place_id}
                    accessibilityRole="button"
                    accessibilityLabel={`Open ${p.name}`}
                    onPress={() => router.push(`/(tabs)/spot/${p.place_id}` as never)}
                    style={styles.row}
                  >
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.rowName} numberOfLines={1}>
                        {p.name}
                      </Text>
                      <Text style={styles.rowMeta} numberOfLines={1}>
                        {[hubLabel(p.hub), p.zone].filter(Boolean).join(' · ').toUpperCase() || '—'}
                      </Text>
                      {p.note ? (
                        <Text style={styles.rowNote} numberOfLines={2}>
                          "{p.note}"
                        </Text>
                      ) : null}
                    </View>
                    <Text style={styles.chevron}>›</Text>
                  </Pressable>
                ))}
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
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 14 },
  name: { fontFamily: SERIF, fontSize: 26, color: INK, letterSpacing: -0.5 },
  matchLine: { fontFamily: SANS_BOLD, fontSize: 13, color: CORAL, marginTop: 3 },
  matchMuted: { fontFamily: SANS, fontSize: 12.5, color: MUTE, marginTop: 3 },
  followBtn: {
    borderWidth: 1.5,
    borderColor: CORAL,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  followBtnOn: { borderColor: HAIR },
  followLabel: { fontFamily: SANS_SEMI, fontSize: 13, color: CORAL },
  empty: { fontFamily: SANS, fontSize: 13, color: MUTE, marginTop: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: HAIR,
    backgroundColor: CARD,
  },
  rowName: { fontFamily: SANS_SEMI, fontSize: 15, color: INK },
  rowMeta: {
    fontFamily: SANS_BOLD,
    fontSize: 10.5,
    letterSpacing: 0.6,
    color: MUTE,
    marginTop: 3,
  },
  rowNote: {
    fontFamily: SERIF_IT,
    fontSize: 14.5,
    lineHeight: 21,
    color: INK,
    marginTop: 6,
  },
  chevron: { fontFamily: SANS, fontSize: 22, color: '#B7AE9F' },
});
