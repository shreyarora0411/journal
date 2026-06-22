import { Eyebrow, Face, Page, StatusSpace } from '@/components';
import { useAuthStore } from '@/features/auth';
import { log } from '@/lib/log';
import type { VouchType } from '@journal/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useList } from '../api/use-lists';
import { type ListVouch, useListVouches } from '../api/use-list-vouches';

const INK = '#1A1410';
const MUTE = '#7A716A';
const FAINT = '#B7AE9F';
const HAIR = '#EFEAE2';
const TINT = '#FAF6F0';

const TYPE_LABEL: Record<VouchType, string> = {
  stay: 'Stay',
  eat_drink: 'Eat / Drink',
  do: 'Do',
  good_to_know: 'Good to know',
  skip: 'Skip',
};
const TYPE_ORDER: VouchType[] = ['stay', 'eat_drink', 'do', 'good_to_know', 'skip'];

/**
 * List detail (v3.1) — replaces the trip-detail screen for vouches. Shows
 * the list name + owner, and the vouches in it grouped by category, in each
 * friend's own words. A list can mix the owner's own vouches and ones they
 * saved from others (§6).
 */
export function ListDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const listQ = useList(id ?? null);
  const vouchesQ = useListVouches(id ?? null);
  const meId = useAuthStore((s) => s.session?.user.id ?? null);

  useEffect(() => {
    log.event('list.detail_entered', { id });
  }, [id]);

  const vouches = vouchesQ.data ?? [];
  const grouped = useMemo(() => {
    const map = new Map<VouchType, ListVouch[]>();
    for (const v of vouches) {
      const arr = map.get(v.vouch_type) ?? [];
      arr.push(v);
      map.set(v.vouch_type, arr);
    }
    return TYPE_ORDER.filter((t) => map.has(t)).map((t) => ({ type: t, rows: map.get(t)! }));
  }, [vouches]);

  const list = listQ.data;
  const isMine = meId === (list as { owner_id?: string } | null)?.owner_id;

  return (
    <Page>
      <StatusSpace />
      <ScrollView showsVerticalScrollIndicator={false}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} hitSlop={8}>
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>

        <Text style={styles.title}>{(list as { title?: string } | null)?.title ?? 'List'}</Text>
        <Text style={styles.meta}>
          {isMine ? 'Your list' : 'A list from your circle'} · {vouches.length} vouch
          {vouches.length === 1 ? '' : 'es'}
        </Text>

        {isMine ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add a vouch"
            onPress={() => router.push('/(tabs)/add' as never)}
            style={styles.addBtn}
          >
            <Text style={styles.addLabel}>+ Add a vouch</Text>
          </Pressable>
        ) : null}

        {vouchesQ.isLoading ? (
          <Text style={styles.empty}>Loading…</Text>
        ) : vouches.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No vouches yet.</Text>
            <Text style={styles.emptyBody}>
              {isMine ? 'Add the first one — a place, a dish, a thing to do.' : 'Nothing here yet.'}
            </Text>
          </View>
        ) : (
          <View style={{ marginTop: 22, gap: 24 }}>
            {grouped.map((g) => (
              <View key={g.type} style={{ gap: 10 }}>
                <Eyebrow>{TYPE_LABEL[g.type]}</Eyebrow>
                {g.rows.map((v) => {
                  const who = v.author?.display_name ?? v.author?.handle ?? 'Someone';
                  return (
                    <View key={v.id} style={styles.vouchCard}>
                      <Text style={styles.vouchText}>"{v.text}"</Text>
                      <View style={styles.byRow}>
                        <Face uri={v.author?.avatar_url ?? null} initials={who.slice(0, 2).toUpperCase()} size="sm" />
                        <Text style={styles.byWho}>
                          {who}
                          {v.destination_text ? ` · ${v.destination_text}` : ''}
                        </Text>
                      </View>
                    </View>
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
  back: { fontFamily: 'DMSans_600SemiBold', fontSize: 14, color: MUTE, marginTop: 4 },
  title: {
    fontFamily: 'PlayfairDisplay_500Medium',
    fontSize: 34,
    lineHeight: 38,
    color: INK,
    letterSpacing: -0.8,
    marginTop: 8,
  },
  meta: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: MUTE, marginTop: 6 },
  addBtn: {
    alignSelf: 'flex-start',
    marginTop: 16,
    backgroundColor: TINT,
    borderWidth: 1,
    borderColor: HAIR,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  addLabel: { fontFamily: 'DMSans_600SemiBold', fontSize: 13, color: INK },
  empty: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: MUTE, marginTop: 20 },
  emptyCard: {
    marginTop: 20,
    padding: 18,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: HAIR,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
  },
  emptyTitle: { fontFamily: 'PlayfairDisplay_500Medium', fontSize: 20, color: INK },
  emptyBody: { fontFamily: 'DMSans_400Regular', fontSize: 13, lineHeight: 20, color: MUTE, marginTop: 6 },
  vouchCard: { backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: HAIR, padding: 14 },
  vouchText: {
    fontFamily: 'PlayfairDisplay_500Medium_Italic',
    fontSize: 17,
    lineHeight: 24,
    color: INK,
  },
  byRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  byWho: { fontFamily: 'DMSans_600SemiBold', fontSize: 13, color: MUTE },
});
