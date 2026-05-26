import { Eyebrow, PlacePicker } from '@/components';
import { ListPickerSheet } from '@/features/lists';
import { useCreateTripQuick } from '@/features/trips';
import { useToast } from '@/hooks/use-toast';
import { lookupCountryIdByIso } from '@/lib/country-lookup';
import type { PlaceDetails } from '@/lib/google-places';
import { log } from '@/lib/log';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { DateField } from './DateField';

const CORAL = '#FF4D2E';
const INK = '#1A1410';
const MUTE = '#7A716A';
const TINT = '#FAF6F0';
const HAIR = '#EFEAE2';
const EMERALD = '#00A67E';
const PAPER = '#FFFFFF';

/**
 * Trip log form. Trip-level narrative: title + date range + one
 * destination city + optional prose. Saves through the existing
 * `useCreateTripQuick` path — the resulting trip's seed city is the
 * picked city, and the prose lives on `trips.note`.
 *
 * No category, no verdict, no one-line — those belong to the Tip path.
 * Atomic logs can be attached to the resulting trip later via the
 * AtomicLogForm's attach-to-trip sheet.
 */
export function TripLogForm() {
  const router = useRouter();
  const toast = useToast();
  const createTrip = useCreateTripQuick();

  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [picked, setPicked] = useState<PlaceDetails | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [note, setNote] = useState('');
  const [savedTripId, setSavedTripId] = useState<string | null>(null);

  const placeName = picked?.name ?? null;
  const placeArea = picked ? [picked.region, picked.country].filter(Boolean).join(' · ') : null;

  const onSubmit = async () => {
    if (title.trim().length === 0) {
      toast.show({ message: 'Give your trip a title.', variant: 'error' });
      return;
    }
    if (!picked) {
      toast.show({ message: 'Pick a city from the dropdown.', variant: 'error' });
      return;
    }
    try {
      const countryId = await lookupCountryIdByIso(picked.country_iso);
      const result = await createTrip.mutateAsync({
        title: title.trim(),
        city_name: picked.name,
        start_date: startDate || null,
        end_date: endDate || null,
        note: note.trim() || undefined,
        visibility: 'friends_of_friends',
        city_country_id: countryId,
        city_region: picked.region,
        city_lat: picked.lat,
        city_lng: picked.lng,
        city_google_place_id: picked.google_place_id,
        city_types: picked.types,
      });
      log.event('log.saved', { mode: 'trip' });
      toast.show({ message: 'Trip saved.', variant: 'success' });
      setSavedTripId(result.trip.id);
    } catch (err) {
      log.error('trip log save failed', err);
      toast.show({ message: 'Could not save. Try again.', variant: 'error' });
    }
  };

  return (
    <>
      {/* Title. */}
      <Eyebrow>Title</Eyebrow>
      <View style={styles.titleCard}>
        <TextInput
          accessibilityLabel="Trip title"
          placeholder="Nepal · April 2026"
          placeholderTextColor="#B7AEA5"
          value={title}
          onChangeText={(v) => setTitle(v.slice(0, 120))}
          style={styles.titleInput}
          selectionColor={CORAL}
        />
      </View>

      {/* Dates. */}
      <View style={{ marginTop: 18 }}>
        <Eyebrow>When</Eyebrow>
        <View style={styles.dateRow}>
          <View style={{ flex: 1 }}>
            <DateField label="Start" value={startDate} onChange={setStartDate} />
          </View>
          <View style={{ flex: 1 }}>
            <DateField label="End" value={endDate} onChange={setEndDate} />
          </View>
        </View>
      </View>

      {/* Where — city picker. */}
      <View style={{ marginTop: 18 }}>
        <Eyebrow>Where</Eyebrow>
        {pickerOpen || !placeName ? (
          <View style={{ marginTop: 8 }}>
            <PlacePicker
              mode="city"
              placeholder="Search a city or region…"
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
            accessibilityLabel="Change city"
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

      {/* Prose. */}
      <View style={{ marginTop: 18 }}>
        <Eyebrow>What was the trip</Eyebrow>
        <View style={styles.noteCard}>
          <TextInput
            accessibilityLabel="Trip prose"
            placeholder="Optional — write as much as you want."
            placeholderTextColor="#B7AEA5"
            value={note}
            onChangeText={(v) => setNote(v.slice(0, 20_000))}
            multiline
            style={styles.noteInput}
            selectionColor={CORAL}
          />
        </View>
      </View>

      {/* Visibility. */}
      <View style={styles.visibilityCard}>
        <View style={styles.checkBubble}>
          <Text style={styles.checkGlyph}>✓</Text>
        </View>
        <Text style={styles.visibilityLabel}>
          <Text style={{ color: INK }}>Just my circle</Text> · friends only.
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Save trip"
        onPress={onSubmit}
        disabled={createTrip.isPending}
        style={styles.cta}
      >
        <Text style={styles.ctaLabel}>{createTrip.isPending ? 'Saving…' : 'Save trip ✦'}</Text>
      </Pressable>

      {savedTripId ? (
        <ListPickerSheet
          targetType="trip"
          targetId={savedTripId}
          isOpen={true}
          onClose={() => {
            setSavedTripId(null);
            router.replace('/(tabs)/book');
          }}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  titleCard: {
    marginTop: 8,
    backgroundColor: PAPER,
    borderColor: HAIR,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  titleInput: {
    fontFamily: 'InstrumentSerif_400Italic',
    fontSize: 22,
    lineHeight: 28,
    color: INK,
    minHeight: 32,
  },
  dateRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
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
  noteCard: {
    marginTop: 8,
    backgroundColor: PAPER,
    borderColor: HAIR,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  noteInput: {
    minHeight: 100,
    fontFamily: 'Geist_400Regular',
    fontSize: 15,
    lineHeight: 22,
    color: INK,
    textAlignVertical: 'top',
  },
  visibilityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: TINT,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 18,
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
});
