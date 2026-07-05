import { Face, Page, PlacePicker, StatusSpace } from '@/components';
import { useAuthStore, useUpdateProfile } from '@/features/auth';
import { useFollow, useUnfollow } from '@/features/follows';
import { useToast } from '@/hooks/use-toast';
import type { PlaceDetails } from '@/lib/google-places';
import { hapticSuccess } from '@/lib/haptics';
import { log } from '@/lib/log';
import { getSupabase } from '@/lib/supabase';
import { ALL_HUBS, TASTE_AXES, type TasteAxes, type TasteAxis, hubLabel } from '@journal/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { useLogPlace } from '../api/use-log-place';
import { useSavePriors } from '../api/use-save-priors';
import { useMyPlaces, useMyPriors, useTasteTwins } from '../api/use-taste-data';
import {
  CORAL,
  HAIR,
  INK,
  MUTE,
  SANS,
  SANS_BOLD,
  SANS_SEMI,
  SERIF,
  TASTE_TYPE_SCALE,
  TINT,
} from '../lib/taste-tokens';

// The 4 either/or taps (spec §3 onboarding). Each answer nudges ONE axis ±0.5
// — mild on purpose: priors fold in at weight 2 and real loves take over fast.
const QUESTIONS: { axis: TasteAxis; a: string; b: string; prompt: string }[] = [
  {
    axis: 'substance_scene',
    prompt: 'What makes the night?',
    a: 'The food/drink itself',
    b: 'The room, the crowd',
  },
  {
    axis: 'mellow_lively',
    prompt: 'Your default evening?',
    a: 'Quiet drinks, real talk',
    b: 'Loud, alive, out-out',
  },
  {
    axis: 'adventurous_trusty',
    prompt: 'New opening or old favourite?',
    a: 'Always the new place',
    b: 'The place I trust',
  },
  {
    axis: 'value_splurge',
    prompt: 'On spending?',
    a: 'Find the value gem',
    b: 'Splurge when it’s right',
  },
];

const GOAL = 8;

/** A founder-seeded canonical_places row surfaced as a grid tile — the same
 *  shape PlacePicker.tsx queries for its inline canonical hits, so a tap here
 *  and a tap on a search hit resolve to a PlaceDetails identically. */
type CorpusRow = {
  google_place_id: string;
  name: string;
  hub: string | null;
  zone: string | null;
  destination_text: string | null;
  lat: number | null;
  lng: number | null;
};

const corpusRowToPlace = (row: CorpusRow): PlaceDetails => ({
  google_place_id: row.google_place_id,
  name: row.name,
  country: null,
  country_iso: null,
  region: null,
  locality: row.destination_text,
  lat: row.lat,
  lng: row.lng,
  types: [],
});

/** The seeded corpus (~71 venues, ~15 hubs) as a curated tappable grid —
 *  recognition beats a blank search box for "pick 8 that are so you".
 *  Fail-soft: an error just means the grid is empty and search still works. */
const useCorpusPlaces = () =>
  useQuery({
    queryKey: ['taste', 'corpus-places'],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<CorpusRow[]> => {
      try {
        const { data, error } = await getSupabase()
          .from('canonical_places')
          .select('google_place_id, name, hub, zone, destination_text, lat, lng')
          .not('hub', 'is', null)
          .order('name', { ascending: true })
          .limit(200);
        if (error) throw error;
        return (data ?? []) as CorpusRow[];
      } catch (err) {
        log.warn('corpus-places load failed', { error: String(err) });
        return [];
      }
    },
  });

/** Undoes the immediate loved reaction a grid tap (or search pick) just wrote.
 *  No remove/unlog mutation exists yet anywhere in the taste feature — this is
 *  the minimal counterpart to useLogPlace, scoped to this screen. */
const useUnlogPlace = () => {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  return useMutation({
    mutationFn: async (placeId: string) => {
      if (!userId) throw new Error('Not signed in');
      const { error } = await getSupabase()
        .from('place_reactions')
        .delete()
        .eq('user_id', userId)
        .eq('place_id', placeId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['taste'] });
      qc.invalidateQueries({ queryKey: ['vouches'] });
    },
  });
};

/**
 * Taste setup — the 2-minute onboarding (spec §3): 4 either/or taps (→ private
 * priors), then "pick 8 places that are SO you" from a curated grid (→ real
 * loved reactions), then an optional, skippable "follow a few seed maps"
 * step. A brand-new user leaves with a live taste vector, 8 places on their
 * map, and — if they want it — a head start on the graph. Nothing fabricated.
 */
export function TasteSetupScreen() {
  const router = useRouter();
  const toast = useToast();
  const savePriors = useSavePriors();
  const logPlace = useLogPlace();
  const unlogPlace = useUnlogPlace();
  const updateProfile = useUpdateProfile();
  const follow = useFollow();
  const unfollow = useUnfollow();
  const priorsQ = useMyPriors();
  const placesQ = useMyPlaces();
  const corpusQ = useCorpusPlaces();
  const twinsQ = useTasteTwins();

  const [answers, setAnswers] = useState<Partial<TasteAxes>>({});
  const [phase, setPhase] = useState<'quiz' | 'places' | 'follow'>('quiz');
  const [picked, setPicked] = useState<{ place: PlaceDetails; placeId: string }[]>([]);
  const [pickerKey, setPickerKey] = useState(0);
  const [showSearch, setShowSearch] = useState(false);
  const prefilled = useRef(false);

  useEffect(() => {
    log.event('taste.setup_entered');
  }, []);

  // Re-entry: a returning user's saved answers come back instead of a
  // blank quiz that would overwrite their priors with zeros.
  useEffect(() => {
    if (prefilled.current || !priorsQ.data) return;
    prefilled.current = true;
    const restored: Partial<TasteAxes> = {};
    TASTE_AXES.forEach((axis, i) => {
      const v = priorsQ.data?.[i];
      if (v !== undefined && v !== 0) restored[axis] = v;
    });
    setAnswers((prev) => (Object.keys(prev).length === 0 ? restored : prev));
  }, [priorsQ.data]);

  const existingLoves = (placesQ.data ?? []).filter((p) => p.sentiment === 'loved').length;

  const answered = QUESTIONS.filter((q) => answers[q.axis] !== undefined).length;

  // Curated venues grouped under their hub, ordered to match the app's
  // canonical hub ordering (GCR, The Kitchens, …) rather than raw slug text.
  const sections = useMemo(() => {
    const byHub = new Map<string, CorpusRow[]>();
    for (const row of corpusQ.data ?? []) {
      if (!row.hub) continue;
      const list = byHub.get(row.hub);
      if (list) list.push(row);
      else byHub.set(row.hub, [row]);
    }
    const hubOrder = ALL_HUBS.map((h) => h.slug);
    const rank = (slug: string) => {
      const idx = hubOrder.indexOf(slug);
      return idx === -1 ? Number.POSITIVE_INFINITY : idx;
    };
    return Array.from(byHub.entries())
      .sort((a, b) => rank(a[0]) - rank(b[0]))
      .map(([hub, rows]) => ({ hub, label: hubLabel(hub) ?? hub, rows }));
  }, [corpusQ.data]);

  const onAnswer = (axis: TasteAxis, value: number) =>
    setAnswers((prev) => ({ ...prev, [axis]: value }));

  const onQuizDone = async () => {
    try {
      await savePriors.mutateAsync(answers);
      setPhase('places');
    } catch {
      toast.show({ message: 'Could not save — try again.', variant: 'error' });
    }
  };

  const onPickPlace = async (place: PlaceDetails) => {
    if (picked.some((p) => p.place.google_place_id === place.google_place_id)) return;
    try {
      const result = await logPlace.mutateAsync({ place, sentiment: 'loved' });
      // Fire exactly on the tap that crosses the goal, not on every tap after.
      if (picked.length + 1 === GOAL) hapticSuccess();
      setPicked((prev) => [...prev, { place, placeId: result.placeId }]);
      setPickerKey((k) => k + 1); // remount picker → clears the query
    } catch {
      toast.show({ message: 'Could not add that one — try again.', variant: 'error' });
    }
  };

  const onRemovePlace = async (placeId: string) => {
    const prev = picked;
    setPicked((cur) => cur.filter((p) => p.placeId !== placeId));
    try {
      await unlogPlace.mutateAsync(placeId);
    } catch {
      setPicked(prev);
      toast.show({ message: 'Could not remove that one — try again.', variant: 'error' });
    }
  };

  // The places CTA no longer finishes onboarding directly — it hands off to
  // an optional, skippable follow step, whether the goal was hit or the
  // user chose to finish early.
  const onPlacesDone = () => {
    log.event('taste.setup_places_done', { picked: picked.length });
    setPhase('follow');
  };

  const onFinish = async () => {
    toast.show({
      message:
        picked.length > 0
          ? `Your taste is live — ${picked.length} love${picked.length === 1 ? '' : 's'} on the map.`
          : 'Your taste setup is in.',
      variant: 'success',
    });
    // Taste-setup is now the last gated step in the launch flow (circle/
    // contacts moved to a later re-entry point) — stamp completion here so
    // onboardingNextRoute() sends returning users straight to the map
    // instead of looping them back through the quiz. Never block the
    // navigate on this administrative write.
    try {
      await updateProfile.mutateAsync({ onboarding_completed: true });
    } catch (err) {
      log.warn('onboarding completion stamp failed', { error: String(err) });
    }
    router.replace('/(tabs)/book' as never);
  };

  // A returning user with loves already on the map may finish with 0 new
  // picks — the pick-8 is for the cold start, not a toll booth.
  const canFinish = picked.length > 0 || existingLoves > 0;

  const seedTwins = (twinsQ.data ?? []).slice(0, 3);
  const followedCount = seedTwins.filter((t) => t.followed).length;

  return (
    <Page>
      <StatusSpace />
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Text style={styles.headline}>
          {phase === 'quiz'
            ? 'Two minutes of taste.'
            : phase === 'places'
              ? 'Eight places that are so you.'
              : 'Follow a few seed maps.'}
        </Text>
        <Text style={styles.sub}>
          {phase === 'quiz'
            ? 'Four quick calls — they seed your taste until your logs take over.'
            : phase === 'places'
              ? 'The places you already know you love. They become your map — and how we learn whose picks will land for you.'
              : 'A few taste-matched maps to start your book with. Entirely optional — skip whenever.'}
        </Text>

        {phase === 'quiz' ? (
          <>
            {QUESTIONS.map((q) => {
              const v = answers[q.axis];
              return (
                <View key={q.axis} style={{ marginTop: 22 }}>
                  <Text style={styles.qPrompt}>{q.prompt}</Text>
                  <View style={styles.qRow}>
                    <Pressable
                      accessibilityRole="radio"
                      accessibilityLabel={q.a}
                      accessibilityState={{ selected: v === -0.5 }}
                      onPress={() => onAnswer(q.axis, -0.5)}
                      style={[styles.qBtn, v === -0.5 && styles.qBtnOn]}
                    >
                      <Text style={[styles.qLabel, v === -0.5 && { color: '#FFFFFF' }]}>{q.a}</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="radio"
                      accessibilityLabel={q.b}
                      accessibilityState={{ selected: v === 0.5 }}
                      onPress={() => onAnswer(q.axis, 0.5)}
                      style={[styles.qBtn, v === 0.5 && styles.qBtnOn]}
                    >
                      <Text style={[styles.qLabel, v === 0.5 && { color: '#FFFFFF' }]}>{q.b}</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Continue to picking places"
              onPress={onQuizDone}
              disabled={answered < QUESTIONS.length || savePriors.isPending}
              style={[styles.cta, answered < QUESTIONS.length && styles.ctaDisabled]}
            >
              <Text style={styles.ctaLabel}>
                {savePriors.isPending ? 'Saving…' : `Continue (${answered}/${QUESTIONS.length})`}
              </Text>
            </Pressable>
          </>
        ) : phase === 'places' ? (
          <>
            <View style={{ marginTop: 20 }}>
              {corpusQ.isLoading ? (
                <Text style={styles.sub}>Loading the map…</Text>
              ) : (
                sections.map((section) => (
                  <View key={section.hub} style={styles.hubSection}>
                    <Text style={styles.hubHeader}>{section.label}</Text>
                    <View style={styles.grid}>
                      {section.rows.map((row) => {
                        const match = picked.find(
                          (p) => p.place.google_place_id === row.google_place_id,
                        );
                        const isPicked = Boolean(match);
                        return (
                          <Pressable
                            key={row.google_place_id}
                            accessibilityRole="button"
                            accessibilityLabel={isPicked ? `Remove ${row.name}` : `Add ${row.name}`}
                            accessibilityState={{ selected: isPicked }}
                            disabled={logPlace.isPending || unlogPlace.isPending}
                            onPress={() =>
                              match
                                ? onRemovePlace(match.placeId)
                                : onPickPlace(corpusRowToPlace(row))
                            }
                            style={[styles.tile, isPicked && styles.tileOn]}
                          >
                            <Text
                              style={[styles.tileName, isPicked && styles.tileNameOn]}
                              numberOfLines={2}
                            >
                              {row.name}
                            </Text>
                            <Text style={[styles.tileGlyph, isPicked && styles.tileGlyphOn]}>
                              {isPicked ? '✓' : '+'}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                ))
              )}
            </View>

            {showSearch ? (
              <View style={{ marginTop: 16 }}>
                <PlacePicker
                  key={pickerKey}
                  mode="broad"
                  placeholder="Search a place you love…"
                  onPick={onPickPlace}
                />
              </View>
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Can't find it? Search instead"
                onPress={() => setShowSearch(true)}
                style={styles.searchToggle}
              >
                <Text style={styles.searchToggleLabel}>Can't find it? Search instead ›</Text>
              </Pressable>
            )}

            {picked.length > 0 ? (
              <View style={{ marginTop: 16, gap: 8 }}>
                {picked.map((p) => (
                  <View key={p.placeId} style={styles.pickedRow}>
                    <Text style={styles.pickedName} numberOfLines={1}>
                      {p.place.name}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <Text style={styles.pickedLoved}>Loved</Text>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Remove ${p.place.name} from your picks`}
                        onPress={() => onRemovePlace(p.placeId)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Text style={styles.removeGlyph}>✕</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            ) : null}

            {picked.length >= GOAL ? (
              // A fresh element at this position (vs. reusing the same Text
              // as the count keeps climbing) so the scale-in plays once, on
              // the tap that revealed it — not on every re-render after.
              <Animated.Text entering={ZoomIn.duration(280)} style={styles.counter}>
                {picked.length}/{GOAL} — that’s a taste.
              </Animated.Text>
            ) : (
              <Text style={styles.counter}>
                {picked.length}/{GOAL} — keep going.
              </Text>
            )}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Finish taste setup"
              onPress={onPlacesDone}
              disabled={!canFinish}
              style={[styles.cta, !canFinish && styles.ctaDisabled]}
            >
              <Text style={styles.ctaLabel}>
                {picked.length >= GOAL
                  ? 'Done — show my map'
                  : picked.length === 0 && existingLoves > 0
                    ? 'Done — back to my map'
                    : `Finish with ${picked.length}`}
              </Text>
            </Pressable>
          </>
        ) : (
          <>
            <View style={{ marginTop: 20, gap: 8 }}>
              {twinsQ.isLoading ? (
                <Text style={styles.sub}>Finding a few maps worth following…</Text>
              ) : seedTwins.length === 0 ? (
                <View style={styles.emptyFollowCard}>
                  <Text style={styles.emptyFollowTitle}>No seed maps yet.</Text>
                  <Text style={styles.emptyFollowBody}>
                    Come back to People once more of the tribe logs a few loves — for now, your map
                    stands on its own.
                  </Text>
                </View>
              ) : (
                seedTwins.map((t) => {
                  const who = t.display_name ?? t.handle ?? 'Someone';
                  const pending = follow.isPending || unfollow.isPending;
                  return (
                    <View key={t.user_id} style={styles.followRow}>
                      <Face uri={t.avatar_url} initials={who.slice(0, 2).toUpperCase()} size="md" />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.followName} numberOfLines={1}>
                          {who}
                        </Text>
                        <Text style={styles.followMeta}>{t.love_count} loves</Text>
                      </View>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t.followed ? `Unfollow ${who}` : `Follow ${who}`}
                        accessibilityState={{ selected: t.followed }}
                        disabled={pending}
                        onPress={() =>
                          t.followed ? unfollow.mutate(t.user_id) : follow.mutate(t.user_id)
                        }
                        style={[styles.followBtn, t.followed && styles.followBtnOn]}
                      >
                        <Text style={[styles.followBtnLabel, t.followed && { color: MUTE }]}>
                          {t.followed ? 'Following' : 'Follow'}
                        </Text>
                      </Pressable>
                    </View>
                  );
                })
              )}
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Finish taste setup"
              onPress={onFinish}
              style={styles.cta}
            >
              <Text style={styles.ctaLabel}>
                {seedTwins.length === 0
                  ? 'Done — show my map'
                  : followedCount > 0
                    ? `Continue · following ${followedCount}`
                    : 'Continue without following anyone'}
              </Text>
            </Pressable>
          </>
        )}
        <View style={{ height: 60 }} />
      </ScrollView>
    </Page>
  );
}

const styles = StyleSheet.create({
  headline: {
    fontFamily: SERIF,
    fontSize: TASTE_TYPE_SCALE.display,
    color: INK,
    letterSpacing: -0.6,
    paddingTop: 8,
  },
  sub: {
    fontFamily: SANS,
    fontSize: TASTE_TYPE_SCALE.subhead,
    lineHeight: 21,
    color: MUTE,
    marginTop: 8,
  },
  qPrompt: { fontFamily: SANS_BOLD, fontSize: TASTE_TYPE_SCALE.body, color: INK, marginBottom: 10 },
  qRow: { flexDirection: 'row', gap: 8 },
  qBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: HAIR,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  qBtnOn: { backgroundColor: INK, borderColor: INK },
  qLabel: {
    fontFamily: SANS_SEMI,
    fontSize: TASTE_TYPE_SCALE.body,
    color: INK,
    textAlign: 'center',
  },
  cta: {
    marginTop: 28,
    backgroundColor: CORAL,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  ctaDisabled: { opacity: 0.4 },
  ctaLabel: { fontFamily: SANS_SEMI, fontSize: TASTE_TYPE_SCALE.emphasis, color: '#FFFFFF' },
  hubSection: { marginBottom: 18 },
  hubHeader: {
    fontFamily: SANS_BOLD,
    fontSize: TASTE_TYPE_SCALE.caption,
    letterSpacing: 0.8,
    color: MUTE,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: {
    flexBasis: '47%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    borderWidth: 1,
    borderColor: HAIR,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
  },
  tileOn: { backgroundColor: CORAL, borderColor: CORAL },
  tileName: { flex: 1, fontFamily: SANS_SEMI, fontSize: TASTE_TYPE_SCALE.body, color: INK },
  tileNameOn: { color: '#FFFFFF' },
  tileGlyph: { fontSize: TASTE_TYPE_SCALE.subhead, color: CORAL },
  tileGlyphOn: { color: '#FFFFFF' },
  searchToggle: { marginTop: 16, alignSelf: 'flex-start' },
  searchToggleLabel: { fontFamily: SANS_SEMI, fontSize: TASTE_TYPE_SCALE.body, color: CORAL },
  pickedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    backgroundColor: TINT,
    borderWidth: 1,
    borderColor: HAIR,
  },
  pickedName: {
    fontFamily: SANS_SEMI,
    fontSize: TASTE_TYPE_SCALE.subhead,
    color: INK,
    flex: 1,
    marginRight: 10,
  },
  pickedLoved: {
    fontFamily: SANS_BOLD,
    fontSize: TASTE_TYPE_SCALE.caption,
    color: CORAL,
    letterSpacing: 0.5,
  },
  removeGlyph: { fontSize: TASTE_TYPE_SCALE.subhead, color: MUTE },
  counter: {
    fontFamily: SANS_SEMI,
    fontSize: TASTE_TYPE_SCALE.body,
    color: MUTE,
    marginTop: 16,
    textAlign: 'center',
  },
  followRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: HAIR,
    backgroundColor: '#FFFFFF',
  },
  followName: { fontFamily: SANS_SEMI, fontSize: TASTE_TYPE_SCALE.emphasis, color: INK },
  followMeta: { fontFamily: SANS, fontSize: 12.5, color: MUTE, marginTop: 2 },
  followBtn: {
    borderWidth: 1.5,
    borderColor: CORAL,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  followBtnOn: { borderColor: HAIR },
  followBtnLabel: { fontFamily: SANS_SEMI, fontSize: TASTE_TYPE_SCALE.body, color: CORAL },
  emptyFollowCard: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: HAIR,
    backgroundColor: TINT,
  },
  emptyFollowTitle: {
    fontFamily: SERIF,
    fontSize: TASTE_TYPE_SCALE.headline,
    color: INK,
    letterSpacing: -0.3,
  },
  emptyFollowBody: {
    fontFamily: SANS,
    fontSize: TASTE_TYPE_SCALE.body,
    lineHeight: 19,
    color: MUTE,
    marginTop: 6,
  },
});
