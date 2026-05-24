import { Eyebrow, Face, FaceStack, Page, Photo, StatusSpace } from '@/components';
import { DESTINATIONS, TARA } from '@/features/feed/lib/fixtures';
import { log } from '@/lib/log';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

const CORAL = '#FF4D2E';
const PINK = '#FF3D87';
const INK = '#1A1410';
const MUTE = '#7A716A';
const TINT = '#FAF6F0';

/**
 * Search (#08 of the redesign — Batch B).
 *
 * Layout per the brief:
 *   - Headline: "Where are you going?"
 *   - Tinted pill search input
 *   - Hero card: "Because X just got back" overlaid on a destination image
 *   - "Friends I trust" list: destination rows with thumbnail, FaceStack,
 *     "N friends · M places", optional Hot badge
 */
export function SearchScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');

  useEffect(() => {
    log.event('search.screen_entered');
  }, []);

  // The recommendation hero is the most recently-returned-from friend's
  // current destination. Hardcoded to Tara → Tokyo per the design pack.
  const hero = DESTINATIONS.find((d) => d.slug === 'tokyo');

  return (
    <Page>
      <StatusSpace />
      <Text style={styles.headline}>Where are you going?</Text>

      <View style={styles.searchPill}>
        <Text style={styles.searchGlyph}>⌕</Text>
        <TextInput
          accessibilityLabel="Search destinations"
          placeholder="A city, a place, a friend's name…"
          placeholderTextColor="#B7AEA5"
          value={query}
          onChangeText={setQuery}
          style={styles.searchInput}
          selectionColor={CORAL}
        />
      </View>

      {/* Hero card */}
      {hero ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Because ${TARA.name} just got back — Tokyo`}
          onPress={() => router.push(`/destination/${hero.slug}` as never)}
          style={{ marginTop: 20 }}
        >
          <Photo uri={hero.heroUri} aspectRatio={5 / 4} radius={18}>
            <View style={styles.heroOverlay}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Face uri={TARA.avatarUri} size="sm" ring />
                <Text style={styles.heroCue}>Because {TARA.name} just got back</Text>
              </View>
              <Text style={styles.heroDest}>{hero.name}</Text>
              <Text style={styles.heroSub}>{hero.placeCount} places · 5 friends</Text>
            </View>
          </Photo>
        </Pressable>
      ) : null}

      <View style={{ marginTop: 24 }}>
        <Eyebrow>Friends I trust</Eyebrow>
        <View style={{ gap: 10, marginTop: 12 }}>
          {DESTINATIONS.map((d) => (
            <Pressable
              key={d.slug}
              accessibilityRole="button"
              accessibilityLabel={d.name}
              onPress={() => router.push(`/destination/${d.slug}` as never)}
              style={styles.row}
            >
              <Photo uri={d.heroUri} width={64} height={64} radius={12} />
              <View style={{ flex: 1, gap: 4 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={styles.destName}>{d.name}</Text>
                  {d.hot ? (
                    <View style={styles.hotPill}>
                      <Text style={styles.hotLabel}>HOT</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.country}>{d.country}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  <FaceStack
                    people={d.friends.slice(0, 4).map((f) => ({
                      uri: f.avatarUri,
                      initials: f.name.slice(0, 2),
                    }))}
                    max={4}
                    size="xs"
                  />
                  <Text style={styles.rowMeta}>
                    {d.friends.length} friends · {d.placeCount} places
                  </Text>
                </View>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  headline: {
    fontFamily: 'InstrumentSerif_400Italic',
    fontSize: 36,
    lineHeight: 40,
    color: INK,
    letterSpacing: -0.8,
    marginTop: 16,
  },
  searchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: TINT,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 16,
  },
  searchGlyph: { fontSize: 18, color: MUTE },
  searchInput: {
    flex: 1,
    fontFamily: 'Geist_400Regular',
    fontSize: 15,
    color: INK,
    paddingVertical: 2,
  },
  heroOverlay: { position: 'absolute', left: 16, right: 16, bottom: 16 },
  heroCue: { fontFamily: 'Geist_500Medium', fontSize: 13, color: '#FFFFFF' },
  heroDest: {
    fontFamily: 'InstrumentSerif_400Italic',
    fontSize: 44,
    lineHeight: 46,
    color: '#FFFFFF',
    letterSpacing: -1,
    marginTop: 8,
  },
  heroSub: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 10,
    letterSpacing: 1.4,
    color: '#FFFFFF',
    marginTop: 4,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  destName: {
    fontFamily: 'InstrumentSerif_400Italic',
    fontSize: 22,
    color: INK,
    letterSpacing: -0.4,
  },
  hotPill: {
    backgroundColor: PINK,
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  hotLabel: {
    fontFamily: 'Geist_500Medium',
    fontSize: 9,
    letterSpacing: 0.8,
    color: '#FFFFFF',
  },
  country: { fontFamily: 'Geist_400Regular', fontSize: 12, color: MUTE },
  rowMeta: { fontFamily: 'Geist_400Regular', fontSize: 12, color: MUTE },
  chevron: { fontFamily: 'InstrumentSerif_400Italic', fontSize: 26, color: MUTE },
});
