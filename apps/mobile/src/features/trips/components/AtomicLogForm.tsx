import { CategoryPill, Eyebrow, PlacePicker, type Verdict, VerdictPicker } from '@/components';
import { ListPickerSheet } from '@/features/lists';
import { useCreateAtomicLog, useMyTrips, useResolvePlace } from '@/features/trips';
import { useSetVerdict } from '@/features/verdicts';
import { useToast } from '@/hooks/use-toast';
import type { PlaceDetails } from '@/lib/google-places';
import { log } from '@/lib/log';
import { CATEGORIES, type Category } from '@/theme';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const CORAL = '#FF4D2E';
const INK = '#1A1410';
const MUTE = '#7A716A';
const TINT = '#FAF6F0';
const HAIR = '#EFEAE2';
const EMERALD = '#00A67E';
const PAPER = '#FFFFFF';

const CATEGORIES_ORDER: ReadonlyArray<Category> = ['stay', 'food', 'drinks', 'wander', 'buy'];

/** Per-category placeholder copy — rotates so the field stays fresh. */
const ONE_LINE_PLACEHOLDERS: Record<Category, string> = {
  stay: 'The view from room 412 is unreal.',
  food: 'Order the clams. Skip the lunch queue, go at 4.',
  drinks: 'Their negroni is the best in the city.',
  wander: 'Walk from Kuramae to Asakusa at sunset.',
  buy: 'The vintage section in the back has the real treasures.',
};

/**
 * Atomic (Tip) log form. Category-required, single-line distilled
 * sentence + optional prose. The picker is category-scoped so Food
 * surfaces restaurants/cafés, Stay surfaces hotels, etc.
 *
 * Save pipeline:
 *   1. resolve_google_place → city_id, area_id, country_id
 *   2. insert_atomic_log → venue_id
 *   3. set_verdict(target_type='venue', target_id=venue_id, verdict)
 *   4. (optional) attach to selected trip → already baked into step 2
 *   5. Open list picker on the new venue
 *   6. On picker close, route to /(tabs)/book
 */
export function AtomicLogForm() {
  const router = useRouter();
  const toast = useToast();
  const resolveMutation = useResolvePlace();
  const createMutation = useCreateAtomicLog();
  const verdictMutation = useSetVerdict();
  const tripsQ = useMyTrips();

  const [category, setCategory] = useState<Category | null>(null);
  const [picked, setPicked] = useState<PlaceDetails | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [oneLine, setOneLine] = useState('');
  const [prose, setProse] = useState('');
  const [verdict, setVerdict] = useState<Verdict>('love');
  const [tripId, setTripId] = useState<string | null>(null);
  const [tripSheetOpen, setTripSheetOpen] = useState(false);
  const [savedVenueId, setSavedVenueId] = useState<string | null>(null);

  const placeName = picked?.name ?? null;
  const placeArea = picked ? [picked.region, picked.country].filter(Boolean).join(' · ') : null;
  const selectedTrip = useMemo(
    () => (tripsQ.data ?? []).find((t) => t.id === tripId) ?? null,
    [tripsQ.data, tripId],
  );

  const onSubmit = async () => {
    if (!category) {
      toast.show({ message: 'Pick a category.', variant: 'error' });
      return;
    }
    if (!picked) {
      toast.show({ message: 'Pick a place from the dropdown.', variant: 'error' });
      return;
    }
    if (oneLine.trim().length === 0) {
      toast.show({ message: 'The one line is required.', variant: 'error' });
      return;
    }
    try {
      const resolved = await resolveMutation.mutateAsync({
        google_place_id: picked.google_place_id,
        name: picked.name,
        types: picked.types,
        lat: picked.lat,
        lng: picked.lng,
        country_iso2: picked.country_iso,
        country_name: picked.country,
        // For a venue/area pick the parent locality is the city above
        // it. Google's PlaceDetails already exposes that via `region`
        // (admin level 1) — we don't have the locality place id from
        // the current fetch, so pass null and let the RPC fall back to
        // name match.
        parent_locality_name: picked.region,
        parent_locality_place_id: null,
      });

      const venueId = await createMutation.mutateAsync({
        google_place_id: picked.google_place_id,
        name: picked.name,
        lat: picked.lat,
        lng: picked.lng,
        place_types: picked.types,
        country_iso2: picked.country_iso,
        country_name: picked.country,
        parent_locality_name: picked.region,
        parent_locality_place_id: null,
        category,
        one_line: oneLine.trim(),
        prose: prose.trim() || null,
        trip_id: tripId,
        visibility: 'friends_of_friends',
        city_id: resolved.city_id,
        area_id: resolved.area_id,
      });

      try {
        await verdictMutation.mutateAsync({
          target_type: 'venue',
          target_id: venueId,
          verdict,
        });
      } catch (vErr) {
        log.warn('verdict upsert failed', { error: String(vErr) });
      }

      log.event('log.saved', { mode: 'tip', category, verdict });
      toast.show({ message: 'Added to your book.', variant: 'success' });
      setSavedVenueId(venueId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.error('atomic log save failed', err);
      toast.show({ message: `Could not save: ${msg}`, variant: 'error' });
    }
  };

  const isSaving = resolveMutation.isPending || createMutation.isPending;

  return (
    <>
      {/* Category chips — required, no default. */}
      <Eyebrow>Category</Eyebrow>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
        {CATEGORIES_ORDER.map((c) => (
          <Pressable
            key={c}
            accessibilityRole="button"
            accessibilityLabel={`Set category ${CATEGORIES[c].label}`}
            accessibilityState={{ selected: c === category }}
            onPress={() => setCategory(c)}
          >
            <CategoryPill category={c} variant={c === category ? 'filled' : 'outlined'} />
          </Pressable>
        ))}
      </View>

      {/* Where — category-aware picker. */}
      <View style={{ marginTop: 22 }}>
        <Eyebrow>Where</Eyebrow>
        {pickerOpen || !placeName ? (
          <View style={{ marginTop: 8 }}>
            <PlacePicker
              mode="broad"
              category={category ?? undefined}
              placeholder={
                category === 'stay'
                  ? 'Search a hotel…'
                  : category === 'food'
                    ? 'Search a restaurant or café…'
                    : category === 'drinks'
                      ? 'Search a bar…'
                      : category === 'wander'
                        ? 'Search a neighborhood or sight…'
                        : category === 'buy'
                          ? 'Search a shop…'
                          : 'Search a place…'
              }
              initialQuery={placeName ?? ''}
              onPick={(details) => {
                setPicked(details);
                setPickerOpen(false);
              }}
            />
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Change place"
            style={styles.placeCard}
            onPress={() => setPickerOpen(true)}
          >
            <View style={styles.placeThumb}>
              <Text style={{ fontSize: 22, color: MUTE }}>◔</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.placeName}>{placeName}</Text>
              {placeArea ? <Text style={styles.placeArea}>{placeArea}</Text> : null}
            </View>
            <Text style={styles.changeLink}>Change</Text>
          </Pressable>
        )}
      </View>

      {/* The line — italic serif, single-line. */}
      <View style={{ marginTop: 22 }}>
        <Eyebrow>The line</Eyebrow>
        <View style={styles.oneLineCard}>
          <TextInput
            accessibilityLabel="The line"
            placeholder={
              category ? ONE_LINE_PLACEHOLDERS[category] : 'One sentence a friend can act on.'
            }
            placeholderTextColor="#B7AEA5"
            value={oneLine}
            onChangeText={(v) => setOneLine(v.slice(0, 280))}
            style={styles.oneLineInput}
            selectionColor={CORAL}
            maxLength={280}
          />
        </View>
      </View>

      {/* Optional prose. */}
      <View style={{ marginTop: 22 }}>
        <Eyebrow>Anything else?</Eyebrow>
        <View style={styles.proseCard}>
          <TextInput
            accessibilityLabel="The longer thought"
            placeholder="Optional — the longer thought."
            placeholderTextColor="#B7AEA5"
            value={prose}
            onChangeText={(v) => setProse(v.slice(0, 10_000))}
            multiline
            style={styles.proseInput}
            selectionColor={CORAL}
          />
        </View>
      </View>

      {/* Verdict. */}
      <View style={{ marginTop: 22 }}>
        <Eyebrow color={MUTE}>For my book only</Eyebrow>
        <View style={{ marginTop: 10 }}>
          <VerdictPicker value={verdict} onChange={setVerdict} />
        </View>
        <Text style={styles.verdictHint}>
          Stays on your travel book. Friends see the quote, not the rating.
        </Text>
      </View>

      {/* Attach to trip (manual). */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Attach to a trip"
        onPress={() => setTripSheetOpen(true)}
        style={styles.attachChip}
      >
        <Text style={styles.attachLabel}>
          {selectedTrip
            ? `Attached to ${selectedTrip.title}`
            : 'Standalone — tap to attach to a trip'}
        </Text>
        <Text style={styles.attachCaret}>›</Text>
      </Pressable>

      {/* Visibility reassurance. */}
      <View style={styles.visibilityCard}>
        <View style={styles.checkBubble}>
          <Text style={styles.checkGlyph}>✓</Text>
        </View>
        <Text style={styles.visibilityLabel}>
          <Text style={{ color: INK }}>Just my circle</Text> · friends only.
        </Text>
      </View>

      {/* CTA. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add to my book"
        onPress={onSubmit}
        disabled={isSaving}
        style={styles.cta}
      >
        <Text style={styles.ctaLabel}>{isSaving ? 'Saving…' : 'Add to my book ✦'}</Text>
      </Pressable>

      {/* Attach-to-trip sheet. */}
      <Modal
        visible={tripSheetOpen}
        onRequestClose={() => setTripSheetOpen(false)}
        animationType="slide"
        transparent
        statusBarTranslucent
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close sheet"
          onPress={() => setTripSheetOpen(false)}
          style={styles.backdrop}
        />
        <View style={styles.sheetWrap} pointerEvents="box-none">
          <SafeAreaView edges={['bottom']} style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>Attach to a trip</Text>
            <ScrollView style={{ maxHeight: 320 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Keep standalone"
                onPress={() => {
                  setTripId(null);
                  setTripSheetOpen(false);
                }}
                style={[styles.tripRow, tripId === null && styles.tripRowActive]}
              >
                <Text style={styles.tripTitle}>Keep standalone</Text>
                <Text style={styles.tripSub}>Not attached to any trip.</Text>
              </Pressable>
              {(tripsQ.data ?? []).slice(0, 8).map((t) => {
                const isActive = tripId === t.id;
                const dateBit = t.start_date ? new Date(t.start_date).toDateString() : '';
                return (
                  <Pressable
                    key={t.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Attach to ${t.title}`}
                    onPress={() => {
                      setTripId(t.id);
                      setTripSheetOpen(false);
                    }}
                    style={[styles.tripRow, isActive && styles.tripRowActive]}
                  >
                    <Text style={styles.tripTitle}>{t.title}</Text>
                    {dateBit ? <Text style={styles.tripSub}>{dateBit}</Text> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>

      {/* Post-save list picker. */}
      {savedVenueId ? (
        <ListPickerSheet
          targetType="venue"
          targetId={savedVenueId}
          isOpen={true}
          onClose={() => {
            setSavedVenueId(null);
            router.replace('/(tabs)/book');
          }}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  placeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: PAPER,
    borderColor: HAIR,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginTop: 8,
  },
  placeThumb: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: TINT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeName: { fontFamily: 'Geist_500Medium', fontSize: 15, color: INK },
  placeArea: { fontFamily: 'Geist_400Regular', fontSize: 12, color: MUTE, marginTop: 2 },
  changeLink: { fontFamily: 'Geist_500Medium', fontSize: 13, color: CORAL },
  oneLineCard: {
    marginTop: 8,
    backgroundColor: PAPER,
    borderColor: HAIR,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  oneLineInput: {
    fontFamily: 'InstrumentSerif_400Italic',
    fontSize: 22,
    lineHeight: 28,
    color: INK,
    minHeight: 32,
  },
  proseCard: {
    marginTop: 8,
    backgroundColor: PAPER,
    borderColor: HAIR,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  proseInput: {
    minHeight: 80,
    fontFamily: 'Geist_400Regular',
    fontSize: 15,
    lineHeight: 22,
    color: INK,
    textAlignVertical: 'top',
  },
  verdictHint: {
    fontFamily: 'Geist_400Regular',
    fontSize: 12,
    color: MUTE,
    marginTop: 10,
  },
  attachChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: TINT,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 18,
  },
  attachLabel: {
    fontFamily: 'Geist_500Medium',
    fontSize: 13,
    color: INK,
    flex: 1,
  },
  attachCaret: {
    fontFamily: 'InstrumentSerif_400Italic',
    fontSize: 22,
    color: MUTE,
  },
  visibilityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: TINT,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 14,
  },
  checkBubble: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: EMERALD,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkGlyph: {
    color: PAPER,
    fontFamily: 'Geist_500Medium',
    fontSize: 10,
    lineHeight: 10,
  },
  visibilityLabel: {
    flex: 1,
    fontFamily: 'Geist_400Regular',
    fontSize: 13,
    color: MUTE,
  },
  cta: {
    marginTop: 18,
    backgroundColor: CORAL,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
  },
  ctaLabel: {
    fontFamily: 'Geist_500Medium',
    fontSize: 16,
    color: PAPER,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(26, 20, 16, 0.45)',
  },
  sheetWrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: PAPER,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 12,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: HAIR,
    marginBottom: 12,
  },
  sheetTitle: {
    fontFamily: 'InstrumentSerif_400Italic',
    fontSize: 24,
    color: INK,
    marginBottom: 12,
  },
  tripRow: {
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: TINT,
    marginBottom: 8,
  },
  tripRowActive: {
    backgroundColor: 'rgba(0, 166, 126, 0.08)',
    borderWidth: 1,
    borderColor: EMERALD,
  },
  tripTitle: { fontFamily: 'Geist_500Medium', fontSize: 15, color: INK },
  tripSub: { fontFamily: 'Geist_400Regular', fontSize: 12, color: MUTE, marginTop: 2 },
});
