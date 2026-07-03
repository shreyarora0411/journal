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
  const [visibility, setVisibility] = useState<'followers' | 'friends_of_friends' | 'everyone'>(
    'friends_of_friends',
  );

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
        visibility,
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

      {/* Visibility picker — three options. Default: my circle. */}
      <View style={{ marginTop: 18 }}>
        <Eyebrow>Who sees this</Eyebrow>
        <View style={styles.visRow}>
          {(
            [
              { value: 'followers', label: 'Followers', sub: 'Only people who follow me' },
              { value: 'friends_of_friends', label: 'My circle', sub: 'Friends + their friends' },
              { value: 'everyone', label: 'Everyone', sub: 'Anyone on Vouch' },
            ] as const
          ).map((opt) => {
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

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Save & share"
        onPress={onSubmit}
        disabled={createTrip.isPending}
        style={styles.cta}
      >
        <Text style={styles.ctaLabel}>{createTrip.isPending ? 'Saving…' : 'Save & share ✦'}</Text>
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
    fontFamily: 'PlayfairDisplay_500Medium',
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
  placeName: { fontFamily: 'DMSans_600SemiBold', fontSize: 15, color: INK },
  placeArea: { fontFamily: 'DMSans_400Regular', fontSize: 12, color: MUTE, marginTop: 2 },
  changeLink: { fontFamily: 'DMSans_600SemiBold', fontSize: 13, color: CORAL },
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
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    lineHeight: 22,
    color: INK,
    textAlignVertical: 'top',
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
});
