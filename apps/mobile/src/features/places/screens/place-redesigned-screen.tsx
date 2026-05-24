import { CategoryPill, Eyebrow, Face, PullQuote } from '@/components';
import { getPlace } from '@/features/feed/lib/fixtures';
import { log } from '@/lib/log';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const CORAL = '#FF4D2E';
const INK = '#1A1410';
const MUTE = '#7A716A';
const TINT = '#FAF6F0';
const HAIR = '#EFEAE2';

/**
 * Place / Hotel detail (#10 of the redesign — Batch B).
 *
 * 360pt hero carousel with dots → category badge + 40pt italic-serif name
 * → tint card holding the primary friend's voice (face + when + 22pt pull
 * quote + nested coral-bordered tip card) → "Who else stayed" mini
 * quotes → "Stash for my Tokyo" ink CTA + ghost "Open site" link.
 */
export function PlaceRedesignedScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const place = useMemo(() => getPlace(id ?? ''), [id]);
  const screenW = Dimensions.get('window').width;
  const [page, setPage] = useState(0);

  useEffect(() => {
    log.event('place.screen_entered', { id });
  }, [id]);

  if (!place) {
    return (
      <View style={{ flex: 1, backgroundColor: '#FFFFFF', padding: 24 }}>
        <Text style={{ color: MUTE }}>Place not found.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#FFFFFF' }}
      contentContainerStyle={{ paddingBottom: 120 }}
    >
      <View style={{ height: 360 }}>
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / screenW))}
        >
          {place.heroUris.map((uri, i) => (
            <Image
              // biome-ignore lint/suspicious/noArrayIndexKey: ordered hero pages
              key={i}
              source={{ uri }}
              style={{ width: screenW, height: 360 }}
              contentFit="cover"
              accessibilityIgnoresInvertColors
            />
          ))}
        </ScrollView>

        <View style={[styles.actionRow, { top: insets.top + 8 }]}>
          <ActionPill glyph="‹" label="Back" onPress={() => router.back()} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <ActionPill glyph="↗" label="Share" onPress={() => undefined} />
            <ActionPill glyph="♡" label="Heart" onPress={() => undefined} />
          </View>
        </View>

        <View style={styles.dotsRow}>
          {place.heroUris.map((_, i) => (
            <View
              // biome-ignore lint/suspicious/noArrayIndexKey: positional
              key={i}
              style={[styles.dot, i === page ? styles.dotActive : styles.dotInactive]}
            />
          ))}
        </View>
      </View>

      <View style={{ paddingHorizontal: 22, paddingTop: 20 }}>
        <CategoryPill category={place.category} variant="filled" />
        <Text style={styles.title}>{place.name}</Text>
        <Text style={styles.area}>
          {place.area} · {place.country}
        </Text>
      </View>

      <View style={styles.voiceCard}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Face uri={place.primaryFriend.avatarUri} size="md" />
          <View style={{ flex: 1 }}>
            <Text style={styles.friendName}>{place.primaryFriend.name}</Text>
            <Text style={styles.friendWhen}>{place.primaryWhen}</Text>
          </View>
        </View>
        <View style={{ marginTop: 14 }}>
          <PullQuote size="md">{place.primaryQuote}</PullQuote>
        </View>

        <View style={styles.tipCard}>
          <Eyebrow>His tip</Eyebrow>
          <Text style={styles.tipBody}>{place.primaryTip}</Text>
        </View>
      </View>

      {place.otherFriends.length > 0 ? (
        <View style={{ paddingHorizontal: 22, marginTop: 28 }}>
          <Eyebrow>Who else stayed</Eyebrow>
          <View style={{ gap: 10, marginTop: 12 }}>
            {place.otherFriends.map((o) => (
              <View key={o.friend.id} style={styles.miniVoice}>
                <Face uri={o.friend.avatarUri} size="sm" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.miniFriendName}>{o.friend.name}</Text>
                  <PullQuote size="sm">{o.quote}</PullQuote>
                </View>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <View style={styles.ctaRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Stash for my ${place.destinationName}`}
          style={styles.ctaPrimary}
        >
          <Text style={styles.ctaPrimaryLabel}>Stash for my {place.destinationName}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open site"
          style={styles.ctaGhost}
        >
          <Text style={styles.ctaGhostLabel}>Open site ↗</Text>
        </Pressable>
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
  actionGlyph: {
    fontSize: 18,
    color: INK,
    fontFamily: 'InstrumentSerif_400Italic',
  },
  dotsRow: {
    position: 'absolute',
    bottom: 14,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: { height: 6, borderRadius: 3 },
  dotActive: { width: 24, backgroundColor: '#FFFFFF' },
  dotInactive: { width: 6, backgroundColor: 'rgba(255,255,255,0.5)' },
  title: {
    fontFamily: 'InstrumentSerif_400Italic',
    fontSize: 40,
    lineHeight: 44,
    color: INK,
    letterSpacing: -1,
    marginTop: 10,
  },
  area: {
    fontFamily: 'Geist_400Regular',
    fontSize: 13,
    color: MUTE,
    marginTop: 4,
  },
  voiceCard: {
    marginHorizontal: 22,
    marginTop: 20,
    backgroundColor: TINT,
    borderRadius: 18,
    padding: 16,
  },
  friendName: { fontFamily: 'Geist_500Medium', fontSize: 15, color: INK },
  friendWhen: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 9,
    letterSpacing: 1.2,
    color: MUTE,
    marginTop: 4,
  },
  tipCard: {
    marginTop: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: CORAL,
    gap: 6,
  },
  tipBody: {
    fontFamily: 'Geist_400Regular',
    fontSize: 14,
    lineHeight: 22,
    color: INK,
  },
  miniVoice: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: HAIR,
  },
  miniFriendName: {
    fontFamily: 'Geist_500Medium',
    fontSize: 13,
    color: INK,
    marginBottom: 4,
  },
  ctaRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 22, marginTop: 28 },
  ctaPrimary: {
    flex: 1,
    backgroundColor: INK,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
  },
  ctaPrimaryLabel: { fontFamily: 'Geist_500Medium', fontSize: 15, color: '#FFFFFF' },
  ctaGhost: {
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: HAIR,
  },
  ctaGhostLabel: { fontFamily: 'Geist_500Medium', fontSize: 15, color: INK },
});
