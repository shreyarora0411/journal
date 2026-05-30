import { CategoryPill, Eyebrow, PlacePicker, type Verdict, VerdictPicker } from '@/components';
import { ListPickerSheet } from '@/features/lists';
import {
  useCreateAtomicLog,
  useCreateTripQuick,
  useMyTrips,
  useResolvePlace,
  useUploadVenuePhoto,
} from '@/features/trips';
import { useSetVerdict } from '@/features/verdicts';
import { useToast } from '@/hooks/use-toast';
import type { PlaceDetails } from '@/lib/google-places';
import { log } from '@/lib/log';
import { CATEGORIES, type Category } from '@/theme';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Visibility = 'followers' | 'friends_of_friends' | 'everyone';

const CORAL = '#FF4D2E';
const INK = '#1A1410';
const MUTE = '#7A716A';
const TINT = '#FAF6F0';
const HAIR = '#EFEAE2';
const EMERALD = '#00A67E';
const PAPER = '#FFFFFF';

const CATEGORIES_ORDER: ReadonlyArray<Category> = [
  'stay',
  'food',
  'drinks',
  'nightlife',
  'wander',
  'do',
  'buy',
];

/** Per-category placeholder copy — rotates so the field stays fresh. */
const ONE_LINE_PLACEHOLDERS: Record<Category, string> = {
  stay: 'The view from room 412 is unreal.',
  food: 'Order the clams. Skip the lunch queue, go at 4.',
  drinks: 'Their negroni is the best in the city.',
  wander: 'Walk from Kuramae to Asakusa at sunset.',
  buy: 'The vintage section in the back has the real treasures.',
  do: 'Take the early boat — the reef is empty before 9.',
  nightlife: 'Late, not early. The floor lifts after midnight.',
};

/**
 * Tappable "Try:" suggestions. Three per category. Tapping fills the
 * one-line input — the user can keep typing from there or save as-is.
 * Lowers the activation barrier of a blank field.
 */
const ONE_LINE_SUGGESTIONS: Record<Category, ReadonlyArray<string>> = {
  stay: [
    'Ask for a room facing the courtyard.',
    'Worth it for the breakfast alone.',
    'Skip the suite. The standard room is the move.',
  ],
  food: [
    'Order the off-menu special — just ask.',
    'Go at 4pm. No queue, full kitchen.',
    'Three rounds of the small plates is the right call.',
  ],
  drinks: [
    "Sit at the bar, talk to whoever's pouring.",
    'Their house cocktail beats anything on the menu.',
    'Late, not early. The room lifts after 10.',
  ],
  wander: [
    'Walk it at sunset, not midday.',
    'Enter from the back gate — most miss it.',
    'Go on a weekday morning before the buses arrive.',
  ],
  buy: [
    'Bargain. They expect it.',
    "Ask for the back room — that's where the real stuff is.",
    'Better than anything in the main market.',
  ],
  do: [
    'Go with a local guide — worth every rupee.',
    'Start early. By 10 the wind picks up.',
    'Book the smaller boat, not the big group tour.',
  ],
  nightlife: [
    'Friday is the night. Other days the floor is dead.',
    "Don't bother before 11. Peak is 1am.",
    'Skip the table service — the bar runs better.',
  ],
};

const VISIBILITY_OPTIONS: ReadonlyArray<{
  value: Visibility;
  label: string;
  sub: string;
}> = [
  { value: 'followers', label: 'Followers', sub: 'Only people who follow me' },
  { value: 'friends_of_friends', label: 'My circle', sub: 'Friends + their friends' },
  { value: 'everyone', label: 'Everyone', sub: 'Anyone on lore' },
];

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
  const uploadPhoto = useUploadVenuePhoto();
  const tripsQ = useMyTrips();
  const createTripMutation = useCreateTripQuick();

  const [category, setCategory] = useState<Category | null>(null);
  const [picked, setPicked] = useState<PlaceDetails | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [oneLine, setOneLine] = useState('');
  const [prose, setProse] = useState('');
  const [verdict, setVerdict] = useState<Verdict>('love');
  const [tripId, setTripId] = useState<string | null>(null);
  const [tripSheetOpen, setTripSheetOpen] = useState(false);
  /** Sticks true the first time the user manually picks/clears a trip.
   *  Used to suppress auto-suggest after a manual override so we don't
   *  fight the user mid-edit. */
  const [tripUserTouched, setTripUserTouched] = useState(false);
  /** Inline-create state inside the trip attach sheet — switches the
   *  sheet from "pick existing" to "name a new trip" without taking the
   *  user out of the tip-log flow. */
  const [creatingTrip, setCreatingTrip] = useState(false);
  const [newTripTitle, setNewTripTitle] = useState('');
  const [savedVenueId, setSavedVenueId] = useState<string | null>(null);
  /** Local URI of the photo the user picked. Uploaded after the
   *  venue insert resolves so we have a venue_id to attach to. */
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<Visibility>('friends_of_friends');

  const placeName = picked?.name ?? null;
  const placeArea = picked ? [picked.region, picked.country].filter(Boolean).join(' · ') : null;
  const selectedTrip = useMemo(
    () => (tripsQ.data ?? []).find((t) => t.id === tripId) ?? null,
    [tripsQ.data, tripId],
  );

  /**
   * Auto-suggest the trip when the user picks a place.
   *
   * Scoring (highest wins; ties → most-recent trip):
   *   +20 — today falls inside the trip's start_date..end_date (active)
   *   +10 — picked.locality matches one of the trip's seed cities
   *    +5 — picked.locality appears (case-insensitively) in the title
   *
   * Suppressed once the user has manually touched the trip picker so we
   * don't overwrite their explicit choice. If the suggestion is wrong
   * one tap on the "Which trip" chip lets them clear it.
   */
  useEffect(() => {
    if (tripUserTouched) return;
    if (!picked) return;
    const trips = tripsQ.data ?? [];
    if (trips.length === 0) return;
    const locality = (picked.locality ?? picked.region ?? '').toLowerCase().trim();
    const today = new Date();
    const todayMs = today.getTime();
    const scored = trips.map((t) => {
      let score = 0;
      if (t.start_date && t.end_date) {
        const startMs = new Date(t.start_date).getTime();
        const endMs = new Date(t.end_date).getTime() + 86_400_000; // include end day
        if (todayMs >= startMs && todayMs <= endMs) score += 20;
      }
      if (locality) {
        const matchCity = (t.cities ?? []).some((c) => c.name.toLowerCase() === locality);
        if (matchCity) score += 10;
        if (t.title.toLowerCase().includes(locality)) score += 5;
      }
      return { trip: t, score };
    });
    scored.sort((a, b) => b.score - a.score);
    const best = scored[0];
    if (best && best.score >= 5) {
      setTripId(best.trip.id);
    }
  }, [picked, tripsQ.data, tripUserTouched]);

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
        // Parent locality = the actual city ("Gurugram"), pulled from
        // Google's `locality` address component. `picked.region` is
        // admin_level_1 (the STATE, e.g. "Haryana") and must NOT be used
        // here — that's how we ended up with cities named "Haryana" in
        // the DB. Fall back to region only if locality is genuinely
        // missing (rare: rural / disputed regions).
        parent_locality_name: picked.locality ?? picked.region,
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
        parent_locality_name: picked.locality ?? picked.region,
        parent_locality_place_id: null,
        category,
        one_line: oneLine.trim(),
        prose: prose.trim() || null,
        trip_id: tripId,
        visibility,
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

      if (photoUri) {
        try {
          await uploadPhoto.mutateAsync({ venueId, uri: photoUri });
        } catch (pErr) {
          log.warn('venue photo upload failed', { error: String(pErr) });
          toast.show({ message: 'Saved, but the photo failed to upload.', variant: 'info' });
        }
      }

      log.event('log.saved', { mode: 'tip', category, verdict });
      toast.show({ message: 'Added to your book.', variant: 'success' });
      setSavedVenueId(venueId);
    } catch (err) {
      // Pull every field a PostgrestError might carry so we know
      // exactly what went wrong server-side. Plain objects passed as
      // the `log.error` error-arg stringify to "[object Object]", so
      // we also dump the raw shape to the dev console via
      // console.error.
      const e = err as {
        code?: string;
        message?: string;
        details?: string;
        hint?: string;
      };
      const code = e?.code ?? null;
      const details = e?.details ?? null;
      const hint = e?.hint ?? null;
      let message: string | null = e?.message ?? (err instanceof Error ? err.message : null);
      if (!message) {
        try {
          message = JSON.stringify(err);
        } catch {
          message = String(err);
        }
      }
      if (code === 'PGRST202' || /could not find the function/i.test(message ?? '')) {
        message =
          'insert_atomic_log RPC missing on the server — apply migrations 31 and 32 in Supabase.';
      }
      // Raw error to the dev console — Postgres error fields included.
      console.error('atomic log save failed', { code, message, details, hint, raw: err });
      log.error('atomic log save failed', err instanceof Error ? err : undefined, {
        code: code ?? '(none)',
        message: message ?? '(none)',
      });
      toast.show({
        message: `Could not save: ${message ?? 'unknown error'}`,
        variant: 'error',
      });
    }
  };

  const isSaving = resolveMutation.isPending || createMutation.isPending || uploadPhoto.isPending;

  const onPickPhoto = async () => {
    if (Platform.OS !== 'web') {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        toast.show({ message: 'No photo permission.', variant: 'error' });
        return;
      }
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
      exif: false,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (asset?.uri) setPhotoUri(asset.uri);
  };

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
                          : category === 'do'
                            ? 'Search an activity, trail, dive site…'
                            : category === 'nightlife'
                              ? 'Search a club, late-night venue…'
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

      {/* Which trip — a tip is a moment INSIDE a trip. Surfaced right
          after the place is picked so trip context is the second
          decision, not an afterthought near visibility. Standalone is
          still valid for one-off tips outside any trip. */}
      <View style={{ marginTop: 22 }}>
        <Eyebrow>Which trip</Eyebrow>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Attach to a trip"
          onPress={() => setTripSheetOpen(true)}
          style={[styles.attachChip, { marginTop: 8 }]}
        >
          <Text style={styles.attachLabel}>
            {selectedTrip
              ? `Inside “${selectedTrip.title}”`
              : 'Standalone — tap to attach to a trip'}
          </Text>
          <Text style={styles.attachCaret}>›</Text>
        </Pressable>
      </View>

      {/* The line — italic serif, single-line. */}
      <View style={{ marginTop: 22 }}>
        <Eyebrow>The line</Eyebrow>

        {/* Try-suggestions — tappable chips above the input. Only
            render once a category is picked (the suggestions are per-
            category) and the user hasn't typed anything yet. */}
        {category && oneLine.length === 0 ? (
          <View style={styles.suggestRow}>
            {ONE_LINE_SUGGESTIONS[category].map((s) => (
              <Pressable
                key={s}
                accessibilityRole="button"
                accessibilityLabel={`Use suggestion: ${s}`}
                onPress={() => setOneLine(s)}
                style={styles.suggestChip}
              >
                <Text style={styles.suggestPrefix}>Try</Text>
                <Text style={styles.suggestText} numberOfLines={1}>
                  {s}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

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

      {/* Photo. One cover photo per atomic log; carousel deferred. */}
      <View style={{ marginTop: 22 }}>
        <Eyebrow>Photo</Eyebrow>
        {photoUri ? (
          <View style={styles.photoCard}>
            <Image source={{ uri: photoUri }} style={styles.photoPreview} contentFit="cover" />
            <View style={styles.photoActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Replace photo"
                onPress={onPickPhoto}
                style={styles.photoActionPill}
              >
                <Text style={styles.photoActionLabel}>Replace</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Remove photo"
                onPress={() => setPhotoUri(null)}
                style={styles.photoActionPill}
              >
                <Text style={styles.photoActionLabel}>Remove</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add a photo"
            onPress={onPickPhoto}
            style={styles.photoEmpty}
          >
            <Text style={styles.photoEmptyGlyph}>＋</Text>
            <Text style={styles.photoEmptyLabel}>Add a photo (optional)</Text>
          </Pressable>
        )}
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

      {/* Visibility picker — three options. Default: my circle. */}
      <View style={{ marginTop: 18 }}>
        <Eyebrow>Who sees this</Eyebrow>
        <View style={styles.visRow}>
          {VISIBILITY_OPTIONS.map((opt) => {
            const isOn = visibility === opt.value;
            return (
              <Pressable
                key={opt.value}
                accessibilityRole="button"
                accessibilityLabel={`Set visibility ${opt.label}`}
                accessibilityState={{ selected: isOn }}
                onPress={() => setVisibility(opt.value)}
                style={[styles.visSeg, isOn && styles.visSegOn]}
              >
                <Text style={[styles.visSegLabel, isOn && styles.visSegLabelOn]}>{opt.label}</Text>
                <Text style={[styles.visSegSub, isOn && styles.visSegSubOn]}>{opt.sub}</Text>
              </Pressable>
            );
          })}
        </View>
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
            <Text style={styles.sheetTitle}>
              {creatingTrip ? 'Name your trip' : 'Attach to a trip'}
            </Text>

            {creatingTrip ? (
              // Inline-create mode — title input + save. Seeds the new
              // trip's city from the place the user already picked, so
              // we don't drag them through a separate flow. If they
              // haven't picked a place yet, fall back to disabling save
              // with a hint.
              <View style={{ paddingHorizontal: 16, paddingTop: 12, gap: 12 }}>
                <TextInput
                  autoFocus
                  value={newTripTitle}
                  onChangeText={setNewTripTitle}
                  placeholder='e.g. "Lisbon, slow week"'
                  placeholderTextColor={MUTE}
                  style={styles.newTripInput}
                  returnKeyType="done"
                />
                {!picked ? (
                  <Text style={styles.newTripHint}>
                    Pick a place above first — we'll use it as the trip's seed city.
                  </Text>
                ) : (
                  <Text style={styles.newTripHint}>
                    Will be seeded in {picked.locality ?? picked.region ?? picked.country ?? 'this city'}.
                  </Text>
                )}
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Cancel"
                    onPress={() => {
                      setCreatingTrip(false);
                      setNewTripTitle('');
                    }}
                    style={[styles.newTripBtn, styles.newTripCancel]}
                  >
                    <Text style={styles.newTripCancelLabel}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Create trip"
                    disabled={
                      !picked || newTripTitle.trim().length === 0 || createTripMutation.isPending
                    }
                    onPress={async () => {
                      if (!picked) return;
                      const cityName = picked.locality ?? picked.region ?? picked.country ?? '';
                      if (!cityName) {
                        toast.show({
                          message: 'No city info from the place — pick another.',
                          variant: 'error',
                        });
                        return;
                      }
                      try {
                        const result = await createTripMutation.mutateAsync({
                          title: newTripTitle.trim(),
                          city_name: cityName,
                          start_date: null,
                          end_date: null,
                          visibility: 'friends_of_friends',
                          city_country_id: null,
                          city_region: picked.region ?? null,
                          city_lat: picked.lat ?? null,
                          city_lng: picked.lng ?? null,
                          city_google_place_id: null,
                          city_types: picked.types ?? null,
                        });
                        setTripId(result.trip.id);
                        setTripUserTouched(true);
                        setCreatingTrip(false);
                        setNewTripTitle('');
                        setTripSheetOpen(false);
                        toast.show({
                          message: `Created "${result.trip.title}". Tip will go inside it.`,
                          variant: 'success',
                        });
                      } catch (err) {
                        const msg = err instanceof Error ? err.message : 'Could not create trip.';
                        toast.show({ message: msg, variant: 'error' });
                      }
                    }}
                    style={[
                      styles.newTripBtn,
                      styles.newTripCreate,
                      (!picked || newTripTitle.trim().length === 0) && { opacity: 0.5 },
                    ]}
                  >
                    <Text style={styles.newTripCreateLabel}>
                      {createTripMutation.isPending ? 'Creating…' : 'Create trip'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 360 }}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Keep standalone"
                  onPress={() => {
                    setTripId(null);
                    setTripUserTouched(true);
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
                        setTripUserTouched(true);
                        setTripSheetOpen(false);
                      }}
                      style={[styles.tripRow, isActive && styles.tripRowActive]}
                    >
                      <Text style={styles.tripTitle}>{t.title}</Text>
                      {dateBit ? <Text style={styles.tripSub}>{dateBit}</Text> : null}
                    </Pressable>
                  );
                })}
                {/* Inline-create trigger — sits at the bottom of the list
                    so it doesn't shadow existing-trip selection. */}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Create a new trip"
                  onPress={() => setCreatingTrip(true)}
                  style={[styles.tripRow, styles.tripRowNew]}
                >
                  <Text style={styles.tripRowNewLabel}>+ Create a new trip</Text>
                </Pressable>
              </ScrollView>
            )}
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
  placeName: { fontFamily: 'DMSans_600SemiBold', fontSize: 15, color: INK },
  placeArea: { fontFamily: 'DMSans_400Regular', fontSize: 12, color: MUTE, marginTop: 2 },
  changeLink: { fontFamily: 'DMSans_600SemiBold', fontSize: 13, color: CORAL },
  suggestRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
    marginBottom: 4,
  },
  suggestChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: TINT,
    borderWidth: 1,
    borderColor: HAIR,
    maxWidth: '100%',
  },
  suggestPrefix: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 9,
    letterSpacing: 1.2,
    color: CORAL,
  },
  suggestText: {
    fontFamily: 'PlayfairDisplay_500Medium',
    fontSize: 13,
    color: INK,
    flexShrink: 1,
  },
  photoCard: {
    marginTop: 8,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: TINT,
    borderWidth: 1,
    borderColor: HAIR,
  },
  photoPreview: {
    width: '100%',
    aspectRatio: 4 / 3,
  },
  photoActions: {
    flexDirection: 'row',
    gap: 8,
    padding: 10,
    backgroundColor: PAPER,
  },
  photoActionPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: HAIR,
  },
  photoActionLabel: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 12,
    color: INK,
  },
  photoEmpty: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 22,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: HAIR,
    backgroundColor: PAPER,
  },
  photoEmptyGlyph: {
    fontSize: 18,
    color: MUTE,
  },
  photoEmptyLabel: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 13,
    color: MUTE,
  },
  visRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  visSeg: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: HAIR,
    backgroundColor: PAPER,
  },
  visSegOn: {
    borderColor: INK,
    backgroundColor: INK,
  },
  visSegLabel: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 13,
    color: INK,
  },
  visSegLabelOn: { color: PAPER },
  visSegSub: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 10,
    color: MUTE,
    marginTop: 2,
  },
  visSegSubOn: { color: 'rgba(255,255,255,0.7)' },
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
    fontFamily: 'PlayfairDisplay_500Medium',
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
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    lineHeight: 22,
    color: INK,
    textAlignVertical: 'top',
  },
  verdictHint: {
    fontFamily: 'DMSans_400Regular',
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
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 13,
    color: INK,
    flex: 1,
  },
  attachCaret: {
    fontFamily: 'PlayfairDisplay_500Medium',
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
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 10,
    lineHeight: 10,
  },
  visibilityLabel: {
    flex: 1,
    fontFamily: 'DMSans_400Regular',
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
    fontFamily: 'DMSans_600SemiBold',
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
    fontFamily: 'PlayfairDisplay_500Medium',
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
  tripTitle: { fontFamily: 'DMSans_600SemiBold', fontSize: 15, color: INK },
  tripSub: { fontFamily: 'DMSans_400Regular', fontSize: 12, color: MUTE, marginTop: 2 },
  tripRowNew: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: HAIR,
    marginTop: 4,
  },
  tripRowNewLabel: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 14,
    color: CORAL,
    textAlign: 'center',
  },
  newTripInput: {
    backgroundColor: TINT,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    color: INK,
  },
  newTripHint: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    color: MUTE,
  },
  newTripBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  newTripCancel: {
    backgroundColor: TINT,
  },
  newTripCancelLabel: { fontFamily: 'DMSans_600SemiBold', fontSize: 14, color: MUTE },
  newTripCreate: {
    backgroundColor: INK,
  },
  newTripCreateLabel: { fontFamily: 'DMSans_600SemiBold', fontSize: 14, color: '#FFFFFF' },
});
