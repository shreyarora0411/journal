import { Eyebrow, Face, FaceStack, Page, StatusSpace } from '@/components';
import { useUpdateProfile } from '@/features/auth';
import { useFollow } from '@/features/follows';
import { useToast } from '@/hooks/use-toast';
import { log } from '@/lib/log';
import * as Contacts from 'expo-contacts';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useMatchContacts } from '../api/use-match-contacts';
import { useMatchedFriends } from '../api/use-matched-friends';

const CORAL = '#FF4D2E';
const INK = '#1A1410';
const MUTE = '#7A716A';
const HAIR = '#EFEAE2';
const TINT = '#FAF6F0';

const isWeb = Platform.OS === 'web';

/**
 * Circle (#03 of the redesign — Batch A). Step 1 of 4.
 *
 * Three connector cards stacked: Instagram (primary, coral border, "Best"
 * badge), Contacts, WhatsApp chat. Instagram and WhatsApp are placeholders
 * pending OAuth (ADR 0005); Contacts is the only live path. Below the
 * cards we summarize matched friends already on lore.
 */
export function CircleScreen() {
  const router = useRouter();
  const toast = useToast();
  const matchContacts = useMatchContacts();
  const matched = useMatchedFriends();
  const follow = useFollow();
  const updateProfile = useUpdateProfile();
  const [adding, setAdding] = useState(false);
  /** Once the user has actually run a contacts match in this session,
   *  we render an inline result line — "5 friends found" or "No one
   *  yet" — so the screen doesn't silently swallow the action. */
  const [matchOutcome, setMatchOutcome] = useState<null | { count: number; uploaded: number }>(
    null,
  );

  useEffect(() => {
    log.event('onboarding.screen_entered', { screen: 'circle' });
  }, []);

  const friends = useMemo(() => matched.data ?? [], [matched.data]);
  const hasMatches = friends.length > 0;

  const onContacts = async () => {
    if (isWeb) {
      toast.show({ message: 'Contacts only works on the iOS / Android app.', variant: 'info' });
      return;
    }
    const { status } = await Contacts.requestPermissionsAsync();
    if (status !== 'granted') {
      log.event('onboarding.contacts_permission_denied');
      toast.show({ message: 'No contacts shared. You can do this later.', variant: 'info' });
      return;
    }
    log.event('onboarding.contacts_permission_granted');
    const { data } = await Contacts.getContactsAsync({
      fields: [Contacts.Fields.PhoneNumbers],
      pageSize: 5_000,
    });
    const phones = (data ?? [])
      .flatMap((c) => c.phoneNumbers ?? [])
      .map((p) => p.number ?? '')
      .filter((p): p is string => p.length > 0);
    try {
      const result = await matchContacts.mutateAsync({ phoneNumbers: phones });
      const refreshed = await matched.refetch();
      const count = refreshed.data?.length ?? result.matchedUserIds.length;
      setMatchOutcome({ count, uploaded: phones.length });
    } catch (err) {
      log.error('match-contacts failed', err);
      toast.show({ message: 'Could not match contacts right now.', variant: 'error' });
    }
  };

  const onAddAll = async () => {
    setAdding(true);
    try {
      for (const f of friends) await follow.mutateAsync(f.id);
      log.event('onboarding.circle_add_all', { count: friends.length });
      toast.show({
        message: `Added ${friends.length} friend${friends.length === 1 ? '' : 's'}.`,
        variant: 'success',
      });
    } catch (err) {
      log.error('circle add-all failed', err);
      toast.show({ message: 'Some adds failed. Try again.', variant: 'error' });
    } finally {
      setAdding(false);
    }
  };

  /** Mark onboarding complete and route to the feed. Used by both
   *  Continue and Skip — Circle is the last gated step in the pilot
   *  flow regardless of match outcome. */
  const finish = async (choice: 'continue' | 'skip' | 'no-matches') => {
    log.event('onboarding.screen_completed', { screen: 'circle', choice });
    try {
      await updateProfile.mutateAsync({ onboarding_completed: true });
    } catch (err) {
      log.warn('onboarding completion stamp failed', { error: String(err) });
    }
    router.replace('/(tabs)/book');
  };

  const onContinue = () => finish(hasMatches ? 'continue' : 'no-matches');
  const onSkip = () => finish('skip');

  return (
    <Page>
      <StatusSpace />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        onPress={() => router.back()}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        style={{ alignSelf: 'flex-start', marginBottom: 8 }}
      >
        <Text style={styles.backGlyph}>‹</Text>
      </Pressable>
      <View style={{ paddingTop: 8, gap: 16 }}>
        <Eyebrow>Step 2 of 2</Eyebrow>
        <Text style={styles.headline}>Bring{'\n'}your circle.</Text>
        <Text style={styles.sub}>
          Lore only works when the people you trust are on it. Pick one source — we'll match the
          rest.
        </Text>
      </View>

      <View style={{ gap: 12, marginTop: 24 }}>
        <ConnectorCard
          title="Contacts"
          subtitle={
            matchContacts.isPending
              ? 'Matching…'
              : hasMatches
                ? `${friends.length} friend${friends.length === 1 ? '' : 's'} already on lore.`
                : 'Find people you already know who are on lore.'
          }
          badge="Best"
          coralBorder
          onPress={onContacts}
          loading={matchContacts.isPending}
        />
        <ConnectorCard
          title="Instagram"
          subtitle="Detect trips from your last 6 months."
          badge="Coming soon"
          onPress={() =>
            toast.show({ message: 'Instagram is coming soon. Try Contacts.', variant: 'info' })
          }
        />
        <ConnectorCard
          title="WhatsApp chat"
          subtitle="Forward a chat to find friends inside it."
          badge="Coming soon"
          onPress={() =>
            toast.show({ message: 'WhatsApp forward is coming soon.', variant: 'info' })
          }
        />
      </View>

      {hasMatches ? (
        <View style={styles.matchedCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <FaceStack
              people={friends.slice(0, 5).map((f) => ({
                uri: f.avatar_url,
                initials: (f.display_name ?? f.handle ?? '??').slice(0, 2),
              }))}
              max={5}
              size="md"
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.matchedTitle}>{friends.length} friends already on lore.</Text>
              <Text style={styles.matchedSub}>Add them and your book gets useful immediately.</Text>
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Add all ${friends.length}`}
            onPress={onAddAll}
            disabled={adding}
            style={styles.addAllPill}
          >
            <Text style={styles.addAllLabel}>
              {adding ? 'Adding…' : `Add all ${friends.length}`}
            </Text>
          </Pressable>
        </View>
      ) : matchOutcome && matchOutcome.count === 0 ? (
        // Honest empty state after a real match attempt — don't leave
        // the user wondering whether anything happened.
        <View style={styles.matchedCard}>
          <Text style={styles.matchedTitle}>No one yet.</Text>
          <Text style={styles.matchedSub}>
            We checked {matchOutcome.uploaded} number{matchOutcome.uploaded === 1 ? '' : 's'} — no
            one in your contacts is on lore yet. Invite a friend, or come back when more of your
            circle joins.
          </Text>
        </View>
      ) : null}

      <View style={{ flex: 1 }} />

      <View style={{ gap: 10, marginTop: 24 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Continue"
          onPress={onContinue}
          style={styles.cta}
        >
          <Text style={styles.ctaLabel}>Continue</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Skip"
          onPress={onSkip}
          style={styles.skip}
        >
          <Text style={styles.skipLabel}>Skip for now</Text>
        </Pressable>
      </View>
    </Page>
  );
}

function ConnectorCard({
  title,
  subtitle,
  badge,
  coralBorder = false,
  loading = false,
  onPress,
}: {
  title: string;
  subtitle: string;
  badge?: string;
  coralBorder?: boolean;
  loading?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      disabled={loading}
      style={[
        styles.connector,
        { borderColor: coralBorder ? CORAL : HAIR, borderWidth: coralBorder ? 1.5 : 1 },
      ]}
    >
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={styles.connectorTitle}>{title}</Text>
          {badge ? (
            <View style={styles.badge}>
              <Text style={styles.badgeLabel}>{badge}</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.connectorSub}>{subtitle}</Text>
      </View>
      <Text style={styles.connectorChevron}>›</Text>
    </Pressable>
  );
}

// Avoid the unused-import lint by using Face elsewhere (kept for visual parity).
// biome-ignore lint/correctness/noUnusedVariables: Face is reserved for future single-face callouts inside Circle.
const _faceReserved = Face;

const styles = StyleSheet.create({
  backGlyph: {
    fontFamily: 'InstrumentSerif_400Italic',
    fontSize: 26,
    lineHeight: 26,
    color: INK,
  },
  headline: {
    fontFamily: 'InstrumentSerif_400Italic',
    fontSize: 44,
    lineHeight: 46,
    color: INK,
    letterSpacing: -1.2,
  },
  sub: {
    fontFamily: 'Geist_400Regular',
    fontSize: 14,
    lineHeight: 22,
    color: MUTE,
  },
  connector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  connectorTitle: {
    fontFamily: 'Geist_500Medium',
    fontSize: 16,
    color: INK,
  },
  connectorSub: {
    fontFamily: 'Geist_400Regular',
    fontSize: 13,
    color: MUTE,
    marginTop: 4,
  },
  connectorChevron: {
    fontFamily: 'InstrumentSerif_400Italic',
    fontSize: 24,
    color: MUTE,
  },
  badge: {
    backgroundColor: CORAL,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeLabel: {
    fontFamily: 'Geist_500Medium',
    fontSize: 10,
    letterSpacing: 0.8,
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  matchedCard: {
    backgroundColor: TINT,
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    gap: 12,
  },
  matchedTitle: {
    fontFamily: 'Geist_500Medium',
    fontSize: 15,
    color: INK,
  },
  matchedSub: {
    fontFamily: 'Geist_400Regular',
    fontSize: 12,
    color: MUTE,
    marginTop: 2,
  },
  addAllPill: {
    alignSelf: 'flex-start',
    backgroundColor: CORAL,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  addAllLabel: {
    fontFamily: 'Geist_500Medium',
    fontSize: 13,
    color: '#FFFFFF',
  },
  cta: {
    backgroundColor: INK,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
  },
  ctaLabel: {
    fontFamily: 'Geist_500Medium',
    fontSize: 16,
    color: '#FFFFFF',
  },
  skip: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  skipLabel: {
    fontFamily: 'Geist_400Regular',
    fontSize: 13,
    color: MUTE,
  },
});
