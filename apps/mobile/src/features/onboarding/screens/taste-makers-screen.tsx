import { Eyebrow, Face, Page, StatusSpace } from '@/components';
import { log } from '@/lib/log';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { TASTE_MAKERS, type TasteMaker } from '../lib/taste-makers';

const CORAL = '#FF4D2E';
const INK = '#1A1410';
const MUTE = '#7A716A';
const HAIR = '#EFEAE2';

/**
 * Taste-makers (#04 of the redesign — Batch A). Conditional cold-start
 * fallback when Circle (#03) produced zero matches.
 *
 * Step 2 of 4 in the counter. Follow pills are stateful (selected = filled
 * coral); selected ids are persisted only locally for this pilot — a
 * future commit wires the real follows mutation.
 */
export function TasteMakersScreen() {
  const router = useRouter();
  const [following, setFollowing] = useState<Set<string>>(new Set());

  useEffect(() => {
    log.event('onboarding.screen_entered', { screen: 'taste-makers' });
  }, []);

  const toggle = (id: string) => {
    setFollowing((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const onContinue = () => {
    log.event('onboarding.screen_completed', {
      screen: 'taste-makers',
      followed: following.size,
    });
    // TODO: wire real follow mutations once we backfill verified-traveler IDs.
    router.replace('/(tabs)/book');
  };

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
        <Eyebrow color={MUTE}>If you don't connect anything</Eyebrow>
        <Text style={styles.headline}>Follow a few{'\n'}taste-makers.</Text>
        <Text style={styles.sub}>
          These are travellers your friends already trust. Your feed picks up where they leave off.
        </Text>
      </View>

      {TASTE_MAKERS.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Coming soon</Text>
          <Text style={styles.emptyBody}>
            We're curating a small group of travelers we vouch for. Once they're on lore, you'll be
            able to follow them here. For now, skip ahead — your friends carry the feed.
          </Text>
        </View>
      ) : (
        <View style={{ gap: 12, marginTop: 24 }}>
          {TASTE_MAKERS.map((m) => (
            <TasteMakerCard
              key={m.id}
              person={m}
              following={following.has(m.id)}
              onToggle={() => toggle(m.id)}
            />
          ))}
        </View>
      )}

      <View style={{ flex: 1 }} />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Continue"
        onPress={onContinue}
        style={styles.cta}
      >
        <Text style={styles.ctaLabel}>
          {TASTE_MAKERS.length === 0
            ? 'Continue'
            : following.size > 0
              ? `Continue · following ${following.size}`
              : 'Continue without following anyone'}
        </Text>
      </Pressable>
    </Page>
  );
}

function TasteMakerCard({
  person,
  following,
  onToggle,
}: {
  person: TasteMaker;
  following: boolean;
  onToggle: () => void;
}) {
  return (
    <View style={styles.card}>
      <Face uri={person.avatarUri} size="md" />
      <View style={{ flex: 1 }}>
        <Text style={styles.name}>{person.name}</Text>
        <Text style={styles.bio}>{person.bio}</Text>
        <Text style={styles.cue}>{person.cue}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={following ? `Unfollow ${person.name}` : `Follow ${person.name}`}
        accessibilityState={{ selected: following }}
        onPress={onToggle}
        style={[styles.followPill, following ? styles.followPillOn : styles.followPillOff]}
      >
        <Text style={[styles.followLabel, following ? { color: '#FFFFFF' } : { color: CORAL }]}>
          {following ? 'Following' : 'Follow'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  backGlyph: {
    fontFamily: 'InstrumentSerif_400Italic',
    fontSize: 26,
    lineHeight: 26,
    color: INK,
  },
  headline: {
    fontFamily: 'InstrumentSerif_400Italic',
    fontSize: 40,
    lineHeight: 44,
    color: INK,
    letterSpacing: -1,
  },
  sub: {
    fontFamily: 'Geist_400Regular',
    fontSize: 14,
    lineHeight: 22,
    color: MUTE,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderColor: HAIR,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
  },
  name: {
    fontFamily: 'Geist_500Medium',
    fontSize: 15,
    color: INK,
  },
  bio: {
    // Italic serif per Session 2 task 8 — bios are the human voice,
    // not a UI label.
    fontFamily: 'InstrumentSerif_400Italic',
    fontSize: 14,
    color: MUTE,
    marginTop: 4,
    letterSpacing: -0.2,
  },
  cue: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 10,
    letterSpacing: 1.2,
    color: MUTE,
    marginTop: 6,
  },
  followPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: CORAL,
  },
  // Session 2 brief: outlined coral when not followed, INK filled when
  // followed — matches the rest of the app's filled-CTA convention.
  followPillOff: { backgroundColor: 'transparent', borderColor: CORAL },
  followPillOn: { backgroundColor: INK, borderColor: INK },
  followLabel: {
    fontFamily: 'Geist_500Medium',
    fontSize: 13,
  },
  emptyCard: {
    marginTop: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: HAIR,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
  },
  emptyTitle: {
    fontFamily: 'InstrumentSerif_400Italic',
    fontSize: 22,
    color: INK,
    letterSpacing: -0.4,
  },
  emptyBody: {
    fontFamily: 'Geist_400Regular',
    fontSize: 13,
    lineHeight: 20,
    color: MUTE,
    marginTop: 8,
  },
  cta: {
    backgroundColor: INK,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  ctaLabel: {
    fontFamily: 'Geist_500Medium',
    fontSize: 16,
    color: '#FFFFFF',
  },
});
