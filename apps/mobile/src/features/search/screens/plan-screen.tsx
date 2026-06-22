import { Eyebrow, Face, Page, StatusSpace } from '@/components';
import { useToast } from '@/hooks/use-toast';
import { log } from '@/lib/log';
import type { VouchType } from '@journal/shared';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSaveVouch, useSavedVouchIds } from '../api/use-save-vouch';
import { type VouchSearchResult, useVouchSearch, vouchReason } from '../api/use-vouch-search';

const CORAL = '#FF4D2E';
const INK = '#1A1410';
const MUTE = '#7A716A';
const FAINT = '#B7AE9F';
const HAIR = '#EFEAE2';
const TINT = '#FAF6F0';

const TYPE_PILL: Record<VouchType, { label: string; fg: string; bg: string }> = {
  stay: { label: 'Stay', fg: '#4E6B45', bg: '#E6EEDF' },
  eat_drink: { label: 'Eat / Drink', fg: '#B23A14', bg: '#FBE6DC' },
  do: { label: 'Do', fg: '#1F5F5C', bg: '#D6E9E7' },
  good_to_know: { label: 'Good to know', fg: '#2F5E6E', bg: '#DEEBEF' },
  skip: { label: 'Skip', fg: '#7A3A20', bg: '#F2E2D2' },
};

type ListGroup = {
  key: string;
  listId: string | null;
  who: string;
  avatar: string | null;
  listTitle: string | null;
  rows: VouchSearchResult[];
};

/**
 * Plan / Search (Loop B home) — the discovery surface.
 *
 * Destination in → trusted friends' vouches out, ranked by WHO said it and
 * grouped by the trip they came from. Person and original wording lead; no
 * generic place list, no stars, no taste-fit score (v3 §4C).
 */
export function PlanScreen() {
  const router = useRouter();
  const toast = useToast();
  const [destination, setDestination] = useState('');
  const [context, setContext] = useState('');
  const q = useVouchSearch(destination, context);
  const savedIds = useSavedVouchIds();
  const saveVouch = useSaveVouch();

  useEffect(() => {
    log.event('plan.screen_entered');
  }, []);

  const results = q.data ?? [];
  const trimmed = destination.trim();
  const showHint = trimmed.length < 2;
  const showNoResults = !showHint && !q.isLoading && results.length === 0;

  // Group ranked vouches by source list, preserving rank order: a list's
  // position is set by its best-ranked vouch. Vouches with no list fall
  // under a per-author bucket keyed by author.
  const groups = useMemo<ListGroup[]>(() => {
    const map = new Map<string, ListGroup>();
    for (const r of results) {
      const key = r.list_id ?? `author:${r.author_id}`;
      const g = map.get(key);
      if (g) g.rows.push(r);
      else
        map.set(key, {
          key,
          listId: r.list_id,
          who: r.is_own ? 'You' : (r.author_name ?? r.author_handle ?? 'Someone'),
          avatar: r.author_avatar,
          listTitle: r.list_title,
          rows: [r],
        });
    }
    return [...map.values()];
  }, [results]);

  return (
    <Page>
      <StatusSpace />
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Text style={styles.headline}>Where are you going?</Text>

        <View style={styles.searchPill}>
          <Text style={styles.searchGlyph}>⌕</Text>
          <TextInput
            accessibilityLabel="Destination"
            placeholder="Spiti, Bangkok, Goa…"
            placeholderTextColor={FAINT}
            value={destination}
            onChangeText={setDestination}
            style={styles.searchInput}
            selectionColor={CORAL}
          />
        </View>

        {!showHint ? (
          <TextInput
            accessibilityLabel="Trip context"
            placeholder="couple, 4 nights, food and neighbourhoods (optional)"
            placeholderTextColor={FAINT}
            value={context}
            onChangeText={setContext}
            style={styles.contextInput}
            selectionColor={CORAL}
          />
        ) : null}

        {showHint ? (
          <Text style={styles.hint}>
            Search a place. You'll see what your circle vouched for — in their words.
          </Text>
        ) : q.isLoading ? (
          <Text style={styles.hint}>Searching…</Text>
        ) : showNoResults ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Nothing from your circle yet.</Text>
            <Text style={styles.emptyBody}>
              No one in your network has vouched for "{trimmed}". Ask them directly.
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Ask your circle"
              onPress={() => router.push('/(tabs)/ask' as never)}
              style={styles.askBtn}
            >
              <Text style={styles.askLabel}>Ask your circle</Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ marginTop: 18, gap: 22 }}>
            <Eyebrow>
              {results.length} vouch{results.length === 1 ? '' : 'es'} for {trimmed}
            </Eyebrow>
            {groups.map((g) => (
              <View key={g.key} style={{ gap: 10 }}>
                {/* List header — the person + the list these came from */}
                <View style={styles.tripHeader}>
                  <Face uri={g.avatar} initials={g.who.slice(0, 2).toUpperCase()} size="sm" />
                  <Text style={styles.tripWho}>{g.who}</Text>
                  {g.listTitle ? (
                    <>
                      <Text style={styles.dot}>·</Text>
                      <Text style={styles.tripTitle} numberOfLines={1}>
                        {g.listTitle}
                      </Text>
                    </>
                  ) : null}
                </View>

                {g.rows.map((r) => {
                  const pill = TYPE_PILL[r.vouch_type];
                  const isSaved = savedIds.data?.has(r.vouch_id) ?? false;
                  const onSave = async () => {
                    if (isSaved) return;
                    try {
                      await saveVouch.mutateAsync({
                        vouchId: r.vouch_id,
                        destinationText: r.destination_text,
                      });
                      toast.show({ message: `Saved to your ${r.destination_text} plan.`, variant: 'success' });
                    } catch (err) {
                      log.error('save vouch failed', err);
                      toast.show({ message: 'Could not save. Try again.', variant: 'error' });
                    }
                  };
                  return (
                    <Pressable
                      key={r.vouch_id}
                      accessibilityRole="button"
                      accessibilityLabel={`${pill.label}: ${r.vouch_text}`}
                      onPress={() =>
                        r.list_id ? router.push(`/(tabs)/list/${r.list_id}` as never) : undefined
                      }
                      style={styles.vouchCard}
                    >
                      <View style={styles.vouchHead}>
                        <View style={[styles.pill, { backgroundColor: pill.bg }]}>
                          <Text style={[styles.pillLabel, { color: pill.fg }]}>{pill.label}</Text>
                        </View>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={isSaved ? 'Saved' : 'Save to plan'}
                          onPress={onSave}
                          hitSlop={8}
                          style={styles.saveBtn}
                        >
                          <Text style={[styles.saveGlyph, isSaved && styles.saveGlyphOn]}>
                            {isSaved ? '🔖' : '+ Save'}
                          </Text>
                        </Pressable>
                      </View>
                      <Text style={styles.vouchText}>"{r.vouch_text}"</Text>
                      <Text style={styles.reason}>{vouchReason(r)}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
        )}
        <View style={{ height: 48 }} />
      </ScrollView>
    </Page>
  );
}

const styles = StyleSheet.create({
  headline: {
    fontFamily: 'PlayfairDisplay_500Medium',
    fontSize: 34,
    lineHeight: 38,
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
  searchInput: { flex: 1, fontFamily: 'DMSans_400Regular', fontSize: 15, color: INK, paddingVertical: 2 },
  contextInput: {
    marginTop: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: HAIR,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontFamily: 'DMSans_400Regular',
    fontSize: 13.5,
    color: INK,
  },
  hint: {
    marginTop: 20,
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    lineHeight: 20,
    color: MUTE,
  },
  emptyCard: {
    marginTop: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: HAIR,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
  },
  emptyTitle: { fontFamily: 'PlayfairDisplay_500Medium', fontSize: 22, color: INK, letterSpacing: -0.4 },
  emptyBody: { fontFamily: 'DMSans_400Regular', fontSize: 13, lineHeight: 20, color: MUTE, marginTop: 8 },
  askBtn: {
    marginTop: 16,
    backgroundColor: CORAL,
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
  },
  askLabel: { fontFamily: 'DMSans_600SemiBold', fontSize: 14, color: '#FFFFFF' },
  tripHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tripWho: { fontFamily: 'DMSans_600SemiBold', fontSize: 14, color: INK },
  dot: { color: FAINT },
  tripTitle: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: MUTE, flexShrink: 1 },
  vouchCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: HAIR,
    padding: 14,
  },
  vouchHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  pillLabel: { fontFamily: 'DMSans_600SemiBold', fontSize: 11, letterSpacing: 0.3 },
  saveBtn: { paddingHorizontal: 4, paddingVertical: 2 },
  saveGlyph: { fontFamily: 'DMSans_600SemiBold', fontSize: 13, color: CORAL },
  saveGlyphOn: { fontSize: 15 },
  vouchText: {
    fontFamily: 'PlayfairDisplay_500Medium_Italic',
    fontSize: 17,
    lineHeight: 24,
    color: INK,
    marginTop: 10,
  },
  reason: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 11,
    letterSpacing: 0.4,
    color: FAINT,
    textTransform: 'uppercase',
    marginTop: 10,
  },
});
