import { Eyebrow, Face, Page, StatusSpace } from '@/components';
import { useAuthStore } from '@/features/auth';
import { buildPersonalInviteText } from '@/features/invite';
import { log } from '@/lib/log';
import { joinContexts } from '@/lib/trust-context';
import { useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { type CircleMember, useCircle } from '../api/use-circle';

const CORAL = '#FF4D2E';
const INK = '#1A1410';
const MUTE = '#7A716A';
const FAINT = '#B7AE9F';
const HAIR = '#EFEAE2';
const TINT = '#FAF6F0';

const inviteViaWhatsApp = async (text: string) => {
  const url = `whatsapp://send?text=${encodeURIComponent(text)}`;
  const can = await Linking.canOpenURL(url).catch(() => false);
  if (can) {
    await Linking.openURL(url);
    return;
  }
  // Fallback to the share-only universal URL when WhatsApp isn't installed.
  await Linking.openURL(`https://wa.me/?text=${encodeURIComponent(text)}`).catch(() => null);
};

/** Directory row sub-line — WHAT this person is trusted for, by domain. Reads
 *  the same trust signal as the profile known-for line (lib/trust-context). */
const trustLine = (m: CircleMember): string => {
  if (!m.trust) return 'No vouches yet';
  const n = m.trust.vouchCount;
  return `Trusted for ${joinContexts(m.trust.contexts)} · ${n} vouch${n === 1 ? '' : 'es'}`;
};

/**
 * Friends · the trust DIRECTORY (not an activity feed).
 *
 * The thesis surface: trust is WHO, domain-specific. This tab answers "who do I
 * trust, and for what?" — a people directory ordered by usefulness (most
 * vouches first, never recency or popularity), each person tagged by the
 * domains they're trusted for. Ask-your-circle lives here as a pinned bar (its
 * canonical home — on-demand supply aimed at the circle). When the circle is
 * empty, the grow block IS the screen: trust is the whole product, so the first
 * job is bringing the people you already text for recs.
 *
 * CUT from the old activity screen: the reverse-chron timeline, "X started
 * following Y" rows, and the verb/bucket machinery. Weak-tie "through your
 * circle" (FoF) is P2, once 2-hop data exists.
 */
export function FriendsScreen() {
  const router = useRouter();
  const circleQ = useCircle();
  const viewerId = useAuthStore((s) => s.session?.user.id ?? null);

  // Personal invite carries ?id=<me> so installed friends / QR scans land
  // already following the inviter. Falls back to link-free copy when signed out.
  const inviteText = useMemo(() => buildPersonalInviteText(viewerId), [viewerId]);

  useEffect(() => {
    log.event('friends.screen_entered');
  }, []);

  // Re-enter the build-your-circle flow post-onboarding (contact matching lives
  // there). `reentry=1` tells the screen not to re-stamp onboarding.
  const goFindFriends = () => router.push('/(auth)/circle?reentry=1');
  const goAsk = () => router.push('/(tabs)/ask' as never);

  const circle = circleQ.data ?? [];
  const isEmpty = !circleQ.isLoading && circle.length === 0;

  return (
    <Page>
      <StatusSpace />

      {/* Header — "Your circle" + Invite (only once there's a circle; in cold
          start the grow block carries its own invite CTA). */}
      <View style={styles.header}>
        <Text style={styles.title}>Your circle</Text>
        {!isEmpty && !circleQ.isLoading ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Invite a friend"
            onPress={() => inviteViaWhatsApp(inviteText)}
            hitSlop={8}
          >
            <Text style={styles.headerLink}>Invite</Text>
          </Pressable>
        ) : null}
      </View>

      {circleQ.isLoading ? (
        <Text style={styles.loading}>Loading…</Text>
      ) : isEmpty ? (
        /* =====================================================
           COLD START — the grow block IS the screen. No circle means
           search has nothing to rank, so the one job here is supply:
           bring the people you already trust (Watts & Dodds — seed dense
           trusting networks, not influencers).
           ===================================================== */
        <View style={styles.cold}>
          <Text style={styles.coldTitle}>The people you trust go here.</Text>
          <Text style={styles.coldBody}>
            Vouched only works once your circle is here — their vouches become your search. Add the
            friends you already text for recommendations.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Find friends from contacts"
            onPress={goFindFriends}
            style={styles.coldPrimary}
          >
            <Text style={styles.coldPrimaryLabel}>Find friends from contacts</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Invite a friend on WhatsApp"
            onPress={() => inviteViaWhatsApp(inviteText)}
            hitSlop={8}
          >
            <Text style={styles.coldSecondary}>Invite a friend on WhatsApp →</Text>
          </Pressable>
        </View>
      ) : (
        <>
          {/* Pinned "Ask your circle" bar — Ask's canonical home. On-demand
              supply aimed at the people below. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ask your circle"
            onPress={goAsk}
            style={styles.askBar}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.askTitle}>Ask your circle</Text>
              <Text style={styles.askSub}>Get a voiced rec on demand</Text>
            </View>
            <Text style={styles.askArrow}>›</Text>
          </Pressable>

          {/* The directory — people ordered by usefulness, each tagged by what
              they're trusted for. */}
          <View style={{ marginTop: 24 }}>
            <Eyebrow>People you trust</Eyebrow>
            <View style={{ gap: 8, marginTop: 12 }}>
              {circle.map((m) => {
                const name = m.display_name ?? (m.handle ? `@${m.handle}` : 'Someone');
                const initials = name.replace(/^@/, '').slice(0, 2).toUpperCase();
                return (
                  <Pressable
                    key={m.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Open ${name}'s profile`}
                    disabled={!m.handle}
                    onPress={() => m.handle && router.push(`/friend/${m.handle}` as never)}
                    style={styles.row}
                  >
                    <Face uri={m.avatar_url} initials={initials} size="md" />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.rowName} numberOfLines={1}>
                        {name}
                      </Text>
                      <Text
                        style={[styles.rowTrust, m.trust ? null : styles.rowTrustMuted]}
                        numberOfLines={1}
                      >
                        {trustLine(m)}
                      </Text>
                    </View>
                    {m.handle ? <Text style={styles.rowChevron}>›</Text> : null}
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Grow footer — invite/find is always reachable, lighter than the
              directory itself. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Find more friends"
            onPress={goFindFriends}
            style={styles.growFooter}
            hitSlop={8}
          >
            <Text style={styles.growFooterLabel}>+ Find more friends</Text>
          </Pressable>
        </>
      )}
    </Page>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingTop: 8,
  },
  title: {
    fontFamily: 'PlayfairDisplay_500Medium',
    fontSize: 28,
    color: INK,
    letterSpacing: -0.6,
  },
  headerLink: { fontFamily: 'DMSans_600SemiBold', fontSize: 13, color: CORAL },
  loading: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: MUTE, marginTop: 24 },

  // Cold start
  cold: { marginTop: 40 },
  coldTitle: {
    fontFamily: 'PlayfairDisplay_500Medium',
    fontSize: 26,
    lineHeight: 32,
    color: INK,
    letterSpacing: -0.5,
  },
  coldBody: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    lineHeight: 22,
    color: MUTE,
    marginTop: 12,
  },
  coldPrimary: {
    marginTop: 24,
    backgroundColor: CORAL,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  coldPrimaryLabel: { fontFamily: 'DMSans_600SemiBold', fontSize: 15, color: '#FFFFFF' },
  coldSecondary: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 14,
    color: CORAL,
    marginTop: 16,
    textAlign: 'center',
  },

  // Pinned Ask bar
  askBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 18,
    padding: 16,
    borderRadius: 16,
    backgroundColor: TINT,
    borderWidth: 1,
    borderColor: HAIR,
  },
  askTitle: { fontFamily: 'DMSans_700Bold', fontSize: 15, color: INK },
  askSub: { fontFamily: 'DMSans_400Regular', fontSize: 12, color: MUTE, marginTop: 2 },
  askArrow: { fontFamily: 'DMSans_700Bold', fontSize: 18, color: CORAL },

  // Directory rows
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: HAIR,
    backgroundColor: '#FFFFFF',
  },
  rowName: { fontFamily: 'DMSans_700Bold', fontSize: 15, color: INK },
  rowTrust: { fontFamily: 'DMSans_400Regular', fontSize: 12.5, color: MUTE, marginTop: 2 },
  rowTrustMuted: { color: FAINT },
  rowChevron: { fontFamily: 'DMSans_400Regular', fontSize: 22, color: FAINT },

  growFooter: { marginTop: 20, paddingVertical: 8, alignItems: 'center' },
  growFooterLabel: { fontFamily: 'DMSans_600SemiBold', fontSize: 13, color: CORAL },
});
