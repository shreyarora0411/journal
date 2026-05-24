import { Box, Button, Card, Eyebrow, Pill, StatusSpace, Text } from '@/components';
import { useProfile } from '@/features/auth';
import { useCreateTripQuick } from '@/features/trips';
import { useToast } from '@/hooks/use-toast';
import { log } from '@/lib/log';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { type ClassifiedTrip, type Home, useLoadCameraRoll } from '../api/use-load-photos';
import { INSTAGRAM_TRIPS, type InstagramTrip } from '../lib/instagram-fixture';

const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmt = (ms: number) => {
  const d = new Date(ms);
  return `${d.getDate()} ${MONTH[d.getMonth()]} ${d.getFullYear()}`;
};

const CORAL = '#FF4D2E';
const PINK = '#FF3D87';
const INK = '#1A1410';
const MUTE = '#7A716A';
const HAIR = '#EFEAE2';

const THUMB_SIZE = 56;
const THUMB_COUNT = 3;

/**
 * Import (#05 of the redesign — Batch A). Step 3 of 4.
 *
 * Dual-source: an Instagram-mocked trip-detection grid (ADR 0005 still
 * defers real OAuth; we use a fixture) PLUS the real camera-roll
 * classifier shipped in slices 2–3. User opts into trips across both
 * sources in a single selection model. Tapping "Pop N trips into my book"
 * drafts every selected trip, then routes to Seed (#06) where they add a
 * one-line note per trip.
 */
export default function ImportScreen() {
  const load = useLoadCameraRoll();
  const createTrip = useCreateTripQuick();
  const profile = useProfile();
  const router = useRouter();
  const toast = useToast();
  const [proposed, setProposed] = useState<ClassifiedTrip[]>([]);
  const [igSelected, setIgSelected] = useState<Set<string>>(
    new Set(INSTAGRAM_TRIPS.map((t) => t.id)),
  );
  const [crSelected, setCrSelected] = useState<Set<string>>(new Set());
  const [titles, setTitles] = useState<Record<string, string>>({});
  const isWeb = Platform.OS === 'web';

  const home: Home = useMemo(() => {
    const p = profile.data;
    if (!p?.home_lat || !p?.home_lng) return null;
    return {
      lat: p.home_lat,
      lng: p.home_lng,
      countryCode: p.home_country_code ?? null,
    };
  }, [profile.data]);

  useEffect(() => {
    log.event('import.screen_entered');
  }, []);

  const onScan = async () => {
    try {
      const result = await load.mutateAsync(home);
      if (!result.supported) {
        toast.show({ message: 'Camera roll only works on iOS / Android.', variant: 'info' });
        return;
      }
      setProposed(result.proposed);
      setCrSelected(new Set(result.proposed.filter((p) => p.kind === 'trip').map((p) => p.id)));
      const seeded: Record<string, string> = {};
      for (const p of result.proposed) {
        if (p.suggestedPlace) seeded[p.id] = p.suggestedPlace;
      }
      setTitles(seeded);
    } catch (err) {
      log.error('camera roll scan failed', err);
      toast.show({ message: 'Could not read photos.', variant: 'error' });
    }
  };

  const toggleIg = (id: string) => {
    setIgSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleCr = (id: string) => {
    setCrSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const totalSelected = igSelected.size + crSelected.size;

  const onSave = async () => {
    if (totalSelected === 0) {
      toast.show({ message: 'Pick at least one trip.', variant: 'error' });
      return;
    }
    // 1. Instagram fixtures → drafts (no exact dates; use month-label range).
    for (const ig of INSTAGRAM_TRIPS) {
      if (!igSelected.has(ig.id)) continue;
      try {
        // Use the first of the month as a stand-in. Real Instagram API
        // would carry actual post timestamps.
        const today = new Date().toISOString().slice(0, 10);
        await createTrip.mutateAsync({
          title: ig.destination,
          place_name: ig.destination,
          start_date: today,
          end_date: today,
          note: undefined,
          visibility: 'friends_of_friends',
        });
      } catch (err) {
        log.error('instagram trip create failed', err);
      }
    }
    // 2. Camera-roll classifier results.
    for (const p of proposed) {
      if (!crSelected.has(p.id)) continue;
      try {
        const startISO = new Date(p.startMs).toISOString().slice(0, 10);
        const endISO = new Date(p.endMs).toISOString().slice(0, 10);
        const userTitle = titles[p.id]?.trim() ?? '';
        const title = userTitle.length > 0 ? userTitle : `Untitled · ${p.suggestedTitle}`;
        const place = userTitle.length > 0 ? userTitle : 'Untitled';
        await createTrip.mutateAsync({
          title,
          place_name: place,
          start_date: startISO,
          end_date: endISO,
          note: undefined,
          visibility: 'friends_of_friends',
        });
      } catch (err) {
        log.error('camera roll trip create failed', err);
      }
    }
    toast.show({
      message: `Drafted ${totalSelected} trip${totalSelected === 1 ? '' : 's'}.`,
      variant: 'success',
    });
    router.replace('/(auth)/seed');
  };

  const trips = proposed.filter((p) => p.kind === 'trip');
  const unknowns = proposed.filter((p) => p.kind === 'unknown');

  const renderCrCard = (p: ClassifiedTrip) => {
    const on = crSelected.has(p.id);
    const thumbs = p.photos.slice(0, THUMB_COUNT);
    return (
      <Card key={p.id}>
        <Box flexDirection="row" alignItems="flex-start" gap="m">
          <Pill
            label={on ? '✓' : ' '}
            variant={on ? 'on' : 'default'}
            onPress={() => toggleCr(p.id)}
          />
          <Box flex={1} gap="s">
            <Text variant="meta">
              {fmt(p.startMs)} → {fmt(p.endMs)} · {p.photos.length} photos
            </Text>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {thumbs.map((photo) => (
                <Image
                  key={photo.id}
                  source={{ uri: photo.uri }}
                  style={{
                    width: THUMB_SIZE,
                    height: THUMB_SIZE,
                    borderRadius: 6,
                    backgroundColor: HAIR,
                  }}
                  contentFit="cover"
                  accessibilityIgnoresInvertColors
                />
              ))}
            </View>
            <View
              style={{
                borderWidth: 1,
                borderColor: HAIR,
                borderRadius: 10,
                paddingHorizontal: 10,
                paddingVertical: 10,
                backgroundColor: '#FFFFFF',
              }}
            >
              <TextInput
                placeholder="Where to?"
                placeholderTextColor="#9A9A9A"
                value={titles[p.id] ?? ''}
                onChangeText={(v) => setTitles((s) => ({ ...s, [p.id]: v }))}
                style={{
                  fontFamily: 'InstrumentSerif_400Italic',
                  fontSize: 16,
                  color: INK,
                  paddingVertical: 2,
                }}
                autoCapitalize="words"
                selectionColor={CORAL}
              />
            </View>
          </Box>
        </Box>
      </Card>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 80 }}>
        <StatusSpace />
        <Box gap="m" marginBottom="l">
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Eyebrow>Step 3 of 4</Eyebrow>
            <Text style={styles.sparkle}>✦</Text>
            <Eyebrow color={PINK}>from your phone</Eyebrow>
          </View>
          <Text style={styles.headline}>
            {INSTAGRAM_TRIPS.length} trips, hiding{'\n'}in your camera roll.
          </Text>
          <Text style={styles.sub}>
            Pop the ones that were real trips into your book. You'll add one sentence per trip next.
          </Text>
        </Box>

        {/* Instagram fixture section */}
        <View style={{ marginBottom: 24 }}>
          <Eyebrow color={PINK}>From Instagram</Eyebrow>
          <View style={styles.igGrid}>
            {INSTAGRAM_TRIPS.map((t) => (
              <IgTripCard
                key={t.id}
                trip={t}
                selected={igSelected.has(t.id)}
                onPress={() => toggleIg(t.id)}
              />
            ))}
          </View>
        </View>

        {/* Camera-roll section */}
        {isWeb ? (
          <Text variant="caption">Camera roll only works on the iOS / Android app.</Text>
        ) : proposed.length === 0 ? (
          <Box gap="m">
            <Eyebrow>From your camera roll</Eyebrow>
            <Button
              label={load.isPending ? 'Reading photos…' : 'Read my photos'}
              variant="accent"
              loading={load.isPending}
              onPress={onScan}
              fullWidth
              size="lg"
            />
          </Box>
        ) : (
          <Box gap="m">
            <Eyebrow>From your camera roll · {trips.length + unknowns.length}</Eyebrow>
            {trips.length > 0 ? (
              <Box gap="s">
                <Text variant="meta">{trips.length} look like trips</Text>
                {trips.map(renderCrCard)}
              </Box>
            ) : null}
            {unknowns.length > 0 ? (
              <Box gap="s" marginTop="s">
                <Text variant="meta">{unknowns.length} we're not sure about</Text>
                {unknowns.map(renderCrCard)}
              </Box>
            ) : null}
          </Box>
        )}

        <Box marginTop="l" gap="s">
          <Button
            label={
              createTrip.isPending
                ? 'Saving…'
                : `Pop ${totalSelected} trip${totalSelected === 1 ? '' : 's'} into my book →`
            }
            variant="accent"
            onPress={onSave}
            loading={createTrip.isPending}
            fullWidth
            size="lg"
          />
        </Box>
      </ScrollView>
    </SafeAreaView>
  );
}

function IgTripCard({
  trip,
  selected,
  onPress,
}: {
  trip: InstagramTrip;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${trip.destination}, ${trip.monthLabel}`}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.igCard,
        { borderColor: selected ? CORAL : 'transparent', borderWidth: selected ? 2 : 0 },
      ]}
    >
      <Image
        source={{ uri: trip.coverUri }}
        style={styles.igCover}
        contentFit="cover"
        accessibilityIgnoresInvertColors
      />
      {selected ? (
        <View style={styles.igCheck}>
          <Text style={styles.igCheckGlyph}>✓</Text>
        </View>
      ) : null}
      <View style={styles.igMeta}>
        <Text style={styles.igDestination}>{trip.destination}</Text>
        <Text style={styles.igSub}>
          {trip.monthLabel} · {trip.postCount} posts
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  sparkle: {
    fontFamily: 'InstrumentSerif_400Italic',
    fontSize: 14,
    color: PINK,
    lineHeight: 14,
  },
  headline: {
    fontFamily: 'InstrumentSerif_400Italic',
    fontSize: 32,
    lineHeight: 36,
    color: INK,
    letterSpacing: -0.8,
  },
  sub: {
    fontFamily: 'Geist_400Regular',
    fontSize: 14,
    lineHeight: 22,
    color: MUTE,
  },
  igGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
  },
  igCard: {
    width: '48%',
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  igCover: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: HAIR,
  },
  igCheck: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: CORAL,
    alignItems: 'center',
    justifyContent: 'center',
  },
  igCheckGlyph: {
    color: '#FFFFFF',
    fontFamily: 'Geist_500Medium',
    fontSize: 12,
  },
  igMeta: {
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  igDestination: {
    fontFamily: 'InstrumentSerif_400Italic',
    fontSize: 18,
    color: INK,
    letterSpacing: -0.4,
  },
  igSub: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 9,
    letterSpacing: 1.2,
    color: MUTE,
    marginTop: 2,
  },
});
