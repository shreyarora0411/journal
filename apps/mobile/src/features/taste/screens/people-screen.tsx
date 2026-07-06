import { Eyebrow, Face, Page, StatusSpace } from '@/components';
import { useAuthStore } from '@/features/auth';
import { useFollow, useUnfollow } from '@/features/follows';
import { buildPersonalInviteText, buildWhatsAppLink } from '@/features/invite';
import { log } from '@/lib/log';
import { TASTE_TUNING } from '@journal/shared';
import { useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useMyPlaces, useTasteTwins } from '../api/use-taste-data';
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
 * People — taste-twins (spec §3, screen 4). Ordered by proven taste-match,
 * never by popularity. HONEST gate: below 8 loves the server returns nothing
 * and this screen says exactly why, with the one action that fixes it.
 */
export function PeopleScreen() {
  const router = useRouter();
  const viewerId = useAuthStore((s) => s.session?.user.id ?? null);
  const twinsQ = useTasteTwins();
  const placesQ = useMyPlaces();
  const follow = useFollow();
  const unfollow = useUnfollow();

  useEffect(() => {
    log.event('taste.people_entered');
  }, []);

  const onInvite = () => {
    log.event('taste.invite_tapped');
    Linking.openURL(buildWhatsAppLink(buildPersonalInviteText(viewerId))).catch(() => undefined);
  };

  const lovedCount = useMemo(
    () => (placesQ.data ?? []).filter((p) => p.sentiment === 'loved').length,
    [placesQ.data],
  );
  const gate = TASTE_TUNING.confidenceMinLoves;
  const twins = twinsQ.data ?? [];
  const gated = lovedCount < gate;

  return (
    <Page>
      <StatusSpace />
      <Text style={styles.headline}>Borrow better taste.</Text>
      <Text style={styles.sub}>
        These are maps to follow. When someone's taste overlaps yours, their loved places become
        your answers.
      </Text>

      {twinsQ.isLoading || placesQ.isLoading ? (
        <Text style={styles.empty}>Loading…</Text>
      ) : twinsQ.isError || placesQ.isError ? (
        <LoadError
          message="Couldn't load people."
          onRetry={() => {
            twinsQ.refetch();
            placesQ.refetch();
          }}
        />
      ) : gated ? (
        <View style={styles.gateCard}>
          <Text style={styles.gateTitle}>This unlocks at {gate} loves.</Text>
          <Text style={styles.gateBody}>
            You're at {lovedCount}. Log {gate - lovedCount} more place
            {gate - lovedCount === 1 ? '' : 's'} you love and we can honestly tell whose taste fits
            yours — we never guess.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Log a place"
            onPress={() => router.push('/(tabs)/add' as never)}
            style={styles.gateCta}
          >
            <Text style={styles.gateCtaLabel}>Log a place</Text>
          </Pressable>
        </View>
      ) : twins.length === 0 ? (
        <View style={styles.gateCard}>
          <Text style={styles.gateTitle}>No maps to borrow yet.</Text>
          <Text style={styles.gateBody}>
            You're past the gate — people appear here as more people log {gate}+ loves.
          </Text>
        </View>
      ) : (
        <View style={{ marginTop: 18 }}>
          <Eyebrow>Whose taste fits yours</Eyebrow>
          <View style={{ gap: 8, marginTop: 12 }}>
            {twins.map((t) => {
              const who = t.display_name ?? t.handle ?? 'Someone';
              const pending = follow.isPending || unfollow.isPending;
              return (
                <View key={t.user_id} style={styles.row}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Open ${who}'s map`}
                    onPress={() => router.push(`/(tabs)/person/${t.user_id}` as never)}
                    style={styles.rowBody}
                  >
                    <Face uri={t.avatar_url} initials={who.slice(0, 2).toUpperCase()} size="md" />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.rowName} numberOfLines={1}>
                        {who}
                      </Text>
                      <Text style={styles.rowMeta}>
                        <Text style={styles.rowMatch}>
                          {Math.round(t.match * 100)}% taste overlap
                        </Text>
                        {'  ·  '}
                        {t.love_count} loves
                      </Text>
                    </View>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t.followed ? `Unfollow ${who}` : `Follow ${who}`}
                    disabled={pending}
                    onPress={() =>
                      t.followed ? unfollow.mutate(t.user_id) : follow.mutate(t.user_id)
                    }
                    hitSlop={{ top: 8, bottom: 8 }}
                    style={[styles.followBtn, t.followed && styles.followBtnOn]}
                  >
                    <Text style={styles.followLabel}>{t.followed ? 'Following' : 'Follow'}</Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Supply-side door: the graph only gets useful when people whose
          taste you trust are on it. Always reachable, never pushy. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Invite someone"
        onPress={onInvite}
        style={styles.inviteCard}
      >
        <Text style={styles.inviteTitle}>Bring someone whose taste you trust.</Text>
        <Text style={styles.inviteBody}>
          Their map makes yours better — send them your link on WhatsApp. ›
        </Text>
      </Pressable>
    </Page>
  );
}

const styles = StyleSheet.create({
  headline: {
    fontFamily: SERIF,
    fontSize: TASTE_TYPE_SCALE.display,
    color: INK,
    letterSpacing: -0.6,
    paddingTop: 8,
  },
  sub: {
    fontFamily: SANS,
    fontSize: TASTE_TYPE_SCALE.subhead,
    lineHeight: 21,
    color: MUTE,
    marginTop: 8,
  },
  empty: { fontFamily: SANS, fontSize: TASTE_TYPE_SCALE.body, color: MUTE, marginTop: 24 },
  gateCard: {
    marginTop: 24,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: HAIR,
    backgroundColor: CARD,
  },
  gateTitle: {
    fontFamily: SERIF,
    fontSize: TASTE_TYPE_SCALE.headlineLg,
    color: INK,
    letterSpacing: -0.4,
  },
  gateBody: { fontFamily: SANS, fontSize: 13.5, lineHeight: 21, color: MUTE, marginTop: 8 },
  gateCta: {
    marginTop: 16,
    backgroundColor: CORAL,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  gateCtaLabel: { fontFamily: SANS_SEMI, fontSize: TASTE_TYPE_SCALE.emphasis, color: '#FFFFFF' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: HAIR,
    backgroundColor: CARD,
  },
  rowBody: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowName: { fontFamily: SANS_SEMI, fontSize: TASTE_TYPE_SCALE.emphasis, color: INK },
  rowMeta: { fontFamily: SANS, fontSize: 12.5, color: MUTE, marginTop: 2 },
  rowMatch: { fontFamily: SANS_BOLD, fontSize: 12.5, color: CORAL },
  // MUTE, not CORAL — coral here is spent on match % above; a Follow
  // button next to every row is routine chrome, not the rare exception.
  followBtn: {
    borderWidth: 1.5,
    borderColor: MUTE,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  followBtnOn: { borderColor: HAIR },
  followLabel: { fontFamily: SANS_SEMI, fontSize: TASTE_TYPE_SCALE.body, color: MUTE },
  inviteCard: {
    marginTop: 20,
    marginBottom: 90,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: HAIR,
    backgroundColor: CARD,
  },
  inviteTitle: {
    fontFamily: SERIF,
    fontSize: TASTE_TYPE_SCALE.headline,
    color: INK,
    letterSpacing: -0.3,
  },
  inviteBody: {
    fontFamily: SANS,
    fontSize: TASTE_TYPE_SCALE.body,
    lineHeight: 19,
    color: MUTE,
    marginTop: 6,
  },
});
