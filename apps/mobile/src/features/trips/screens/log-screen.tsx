import {
  CategoryPill,
  Eyebrow,
  Page,
  PlacePicker,
  StatusSpace,
  type Verdict,
  VerdictPicker,
} from '@/components';
import { useCreateTripQuick } from '@/features/trips';
import { useSetVerdict } from '@/features/verdicts';
import { useToast } from '@/hooks/use-toast';
import { lookupCountryIdByIso } from '@/lib/country-lookup';
import type { PlaceDetails } from '@/lib/google-places';
import { log } from '@/lib/log';
import { CATEGORIES, type Category } from '@/theme';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

const CORAL = '#FF4D2E';
const INK = '#1A1410';
const MUTE = '#7A716A';
const TINT = '#FAF6F0';
const HAIR = '#EFEAE2';
const EMERALD = '#00A67E';

const CATEGORIES_ORDER: ReadonlyArray<Category> = ['stay', 'food', 'drinks', 'wander', 'buy'];

/**
 * Log (#13 of the redesign — Batch C). The "Add" tab.
 *
 * One log screen — no separate v1/v2. VerdictPicker (love/mid/skip) is
 * inline per the brief. Verdict surfaces only on the logger's own profile
 * (rule 2); friends see the quote on this place's detail page.
 *
 * Submit drafts a trip via the existing `useCreateTripQuick` mutation —
 * `verdict` column is not yet on the schema; we drop it on save until the
 * migration lands. The Verdict UI works end-to-end; persistence is the
 * follow-up.
 */
export function LogScreen() {
  const router = useRouter();
  const toast = useToast();
  const createTrip = useCreateTripQuick();
  const verdictMutation = useSetVerdict();

  const [category, setCategory] = useState<Category | null>(null);
  const [body, setBody] = useState('');
  const [verdict, setVerdict] = useState<Verdict>('love');

  // Place state. `picked` is set when the user taps an autocomplete
  // result (full PlaceDetails). `freeText` is set when they bail and
  // type their own. Mutually exclusive — picking clears free text and
  // vice-versa.
  const [picked, setPicked] = useState<PlaceDetails | null>(null);
  const [freeText, setFreeText] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const placeName = picked?.name ?? freeText ?? null;
  const placeArea = picked ? [picked.region, picked.country].filter(Boolean).join(' · ') : null;

  const onSubmit = async () => {
    const trimmed = body.trim();
    if (trimmed.length === 0) {
      toast.show({ message: 'Write a sentence first.', variant: 'error' });
      return;
    }
    if (!placeName) {
      toast.show({ message: 'Pick a place first.', variant: 'error' });
      return;
    }
    if (!category) {
      toast.show({ message: 'Pick a category.', variant: 'error' });
      return;
    }
    try {
      const today = new Date().toISOString().slice(0, 10);
      // Resolve the picker's ISO country code (e.g. "JP") into our
      // canonical country_id. Free-text submissions leave this null.
      const countryId = await lookupCountryIdByIso(picked?.country_iso ?? null);
      const result = await createTrip.mutateAsync({
        title: placeName,
        city_name: placeName,
        start_date: today,
        end_date: today,
        note: trimmed,
        visibility: 'friends_of_friends',
        // City identity — populated only when the user picked a Google
        // autocomplete result; free-text submissions leave these null.
        city_country_id: countryId,
        city_region: picked?.region ?? null,
        city_lat: picked?.lat ?? null,
        city_lng: picked?.lng ?? null,
        city_google_place_id: picked?.google_place_id ?? null,
        city_types: picked?.types ?? null,
      });
      // Persist the verdict on the new trip. Failure here doesn't fail
      // the whole log save — the trip is already in the user's book.
      try {
        await verdictMutation.mutateAsync({
          target_type: 'trip',
          target_id: result.trip.id,
          verdict,
        });
      } catch (vErr) {
        log.warn('verdict upsert failed', { error: String(vErr) });
      }
      log.event('log.saved', { category, verdict });
      toast.show({ message: 'Added to your book.', variant: 'success' });
      router.replace('/(tabs)/book');
    } catch (err) {
      log.error('log save failed', err);
      toast.show({ message: 'Could not save. Try again.', variant: 'error' });
    }
  };

  return (
    <Page>
      <StatusSpace />

      {/* Pilot-fixes session: Quick / Journal toggle removed. One unified
          prose input handles both short tips and long entries — length
          is up to the user, schema enforces 20_000-char max. */}
      <Text style={styles.headline}>Pop something in the book.</Text>

      {/* Place picker — Google Places autocomplete (Session 1 revised).
          Open state shows the live PlacePicker dropdown; closed state
          shows the chosen place summary card with a "Change" link. */}
      {pickerOpen || !placeName ? (
        <View style={{ marginTop: 16 }}>
          <PlacePicker
            mode="broad"
            placeholder="Where did you go?"
            initialQuery={freeText ?? placeName ?? ''}
            onPick={(details) => {
              setPicked(details);
              setFreeText(null);
              setPickerOpen(false);
            }}
            onFreeText={(name) => {
              setPicked(null);
              setFreeText(name);
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

      {/* Category chips */}
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 18, flexWrap: 'wrap' }}>
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

      {/* What I'd tell a friend — single auto-growing input, no length
          gate. Zod still enforces a max of 20_000 chars at save time. */}
      <View style={{ marginTop: 24 }}>
        <Eyebrow>What I'd tell a friend</Eyebrow>
        <View style={styles.inputCard}>
          <TextInput
            accessibilityLabel="What I'd tell a friend"
            placeholder="The clams are not optional. Skip lunch queue, go at 4."
            placeholderTextColor="#B7AEA5"
            value={body}
            onChangeText={(v) => setBody(v.slice(0, 20_000))}
            multiline
            style={styles.input}
            selectionColor={CORAL}
          />
        </View>
      </View>

      {/* The standalone "One tip" input was removed in pilot-fixes;
          a single prose field handles both short tips and longer notes. */}

      {/* Verdict */}
      <View style={{ marginTop: 22 }}>
        <Eyebrow color={MUTE}>For my book only</Eyebrow>
        <View style={{ marginTop: 10 }}>
          <VerdictPicker value={verdict} onChange={setVerdict} />
        </View>
        <Text style={styles.verdictHint}>
          Stays on your travel book. Friends see the quote, not the rating.
        </Text>
      </View>

      {/* Visibility card */}
      <View style={styles.visibilityCard}>
        <View style={styles.checkBubble}>
          <Text style={styles.checkGlyph}>✓</Text>
        </View>
        <Text style={styles.visibilityLabel}>
          <Text style={{ color: INK }}>Just my circle</Text> · 12 friends. No one else. Promise.
        </Text>
      </View>

      {/* CTA */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add to my book"
        onPress={onSubmit}
        disabled={createTrip.isPending}
        style={styles.cta}
      >
        <Text style={styles.ctaLabel}>{createTrip.isPending ? 'Saving…' : 'Add to my book ✦'}</Text>
      </Pressable>
    </Page>
  );
}

const styles = StyleSheet.create({
  headline: {
    fontFamily: 'InstrumentSerif_400Italic',
    fontSize: 32,
    lineHeight: 36,
    color: INK,
    letterSpacing: -0.8,
    marginTop: 20,
  },
  placeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderColor: HAIR,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginTop: 18,
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
  placeArea: {
    fontFamily: 'Geist_400Regular',
    fontSize: 12,
    color: MUTE,
    marginTop: 2,
  },
  changeLink: {
    fontFamily: 'Geist_500Medium',
    fontSize: 13,
    color: CORAL,
  },
  inputCard: {
    marginTop: 10,
    backgroundColor: '#FFFFFF',
    borderColor: HAIR,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  input: {
    minHeight: 100,
    fontFamily: 'InstrumentSerif_400Italic',
    fontSize: 19,
    lineHeight: 26,
    color: INK,
    textAlignVertical: 'top',
  },
  verdictHint: {
    fontFamily: 'Geist_400Regular',
    fontSize: 12,
    color: MUTE,
    marginTop: 10,
  },
  visibilityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: TINT,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 22,
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
    color: '#FFFFFF',
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
    marginTop: 22,
    backgroundColor: CORAL,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
  },
  ctaLabel: {
    fontFamily: 'Geist_500Medium',
    fontSize: 16,
    color: '#FFFFFF',
  },
});
