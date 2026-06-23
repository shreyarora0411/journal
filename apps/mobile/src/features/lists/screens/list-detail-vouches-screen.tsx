import { Eyebrow, Face, Page, StatusSpace } from '@/components';
import { useAuthStore } from '@/features/auth';
import { log } from '@/lib/log';
import type { VouchType } from '@journal/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useList } from '../api/use-lists';
import { type ListVouch, useListVouches } from '../api/use-list-vouches';

const INK = '#1A1410';
const MUTE = '#7A716A';
const FAINT = '#B7AE9F';
const HAIR = '#EFEAE2';
const CORAL = '#FF4D2E';

const TYPE_LABEL: Record<VouchType, string> = {
  stay: 'Stay',
  eat_drink: 'Eat / Drink',
  do: 'Do',
  nightlife: 'Nightlife',
  good_to_know: 'Good to know',
  skip: 'Skip',
};
const TYPE_ORDER: VouchType[] = ['stay', 'eat_drink', 'do', 'nightlife', 'good_to_know', 'skip'];

/**
 * List detail (v3.1, scannable). Vouches grouped by category, with a count
 * per section and collapse toggles so a 25-vouch trip stays navigable. When
 * a section spans multiple destinations (a trip list like Bangkok+Phangan+
 * Samui), a small destination sub-label separates them.
 */
export function ListDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const listQ = useList(id ?? null);
  const vouchesQ = useListVouches(id ?? null);
  const meId = useAuthStore((s) => s.session?.user.id ?? null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    log.event('list.detail_entered', { id });
  }, [id]);

  const vouches = vouchesQ.data ?? [];
  const grouped = useMemo(() => {
    const byType = new Map<VouchType, ListVouch[]>();
    for (const v of vouches) {
      const arr = byType.get(v.vouch_type) ?? [];
      arr.push(v);
      byType.set(v.vouch_type, arr);
    }
    return TYPE_ORDER.filter((t) => byType.has(t)).map((t) => {
      const rows = byType.get(t)!;
      // Sub-group by destination, preserving first-seen order.
      const dests: string[] = [];
      const byDest = new Map<string, ListVouch[]>();
      for (const v of rows) {
        const d = v.destination_text || '—';
        if (!byDest.has(d)) {
          byDest.set(d, []);
          dests.push(d);
        }
        byDest.get(d)!.push(v);
      }
      return {
        type: t,
        count: rows.length,
        multiDest: dests.length > 1,
        dests: dests.map((d) => ({ dest: d, rows: byDest.get(d)! })),
      };
    });
  }, [vouches]);

  const list = listQ.data as { title?: string; owner_id?: string; destination_text?: string } | null;
  const isMine = meId === list?.owner_id;

  const onAddVouch = () =>
    router.push({
      pathname: '/(tabs)/add',
      params: {
        listId: id ?? '',
        listTitle: list?.title ?? '',
        destination: list?.destination_text ?? '',
      },
    } as never);

  return (
    <Page>
      <StatusSpace />
      <ScrollView showsVerticalScrollIndicator={false}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} hitSlop={8}>
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>

        <Text style={styles.title}>{list?.title ?? 'List'}</Text>
        <Text style={styles.meta}>
          {isMine ? 'Your list' : 'A list from your circle'} · {vouches.length} vouch
          {vouches.length === 1 ? '' : 'es'}
        </Text>

        {isMine ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add a vouch"
            onPress={onAddVouch}
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
          <View style={{ marginTop: 18, gap: 10 }}>
            {grouped.map((g) => {
              const isCollapsed = collapsed[g.type] ?? false;
              return (
                <View key={g.type} style={{ gap: 10 }}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${TYPE_LABEL[g.type]} section, ${g.count}, ${isCollapsed ? 'collapsed' : 'expanded'}`}
                    onPress={() => setCollapsed((c) => ({ ...c, [g.type]: !isCollapsed }))}
                    style={styles.sectionHeader}
                  >
                    <View style={styles.sectionDot} />
                    <Text style={styles.sectionLabel}>{TYPE_LABEL[g.type].toUpperCase()}</Text>
                    <Text style={styles.sectionCount}>{g.count}</Text>
                    <View style={{ flex: 1 }} />
                    <Text style={styles.chevron}>{isCollapsed ? '▸' : '▾'}</Text>
                  </Pressable>

                  {!isCollapsed
                    ? g.dests.map((d) => (
                        <View key={d.dest} style={{ gap: 10 }}>
                          {g.multiDest ? <Text style={styles.destSub}>{d.dest}</Text> : null}
                          {d.rows.map((v) => {
                            const who = v.author?.display_name ?? v.author?.handle ?? 'Someone';
                            return (
                              <View key={v.id} style={styles.vouchCard}>
                                <Text style={styles.vouchText}>"{v.text}"</Text>
                                <View style={styles.byRow}>
                                  <Face uri={v.author?.avatar_url ?? null} initials={who.slice(0, 2).toUpperCase()} size="sm" />
                                  <Text style={styles.byWho}>
                                    {who}
                                    {!g.multiDest && v.destination_text ? ` · ${v.destination_text}` : ''}
                                  </Text>
                                </View>
                              </View>
                            );
                          })}
                        </View>
                      ))
                    : null}
                </View>
              );
            })}
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
    backgroundColor: '#FAF6F0',
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
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 14,
    paddingBottom: 2,
  },
  sectionDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: CORAL },
  sectionLabel: { fontFamily: 'DMSans_700Bold', fontSize: 11, letterSpacing: 1.4, color: INK },
  sectionCount: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 11,
    letterSpacing: 0.4,
    color: FAINT,
    marginLeft: 2,
  },
  chevron: { fontSize: 12, color: FAINT },
  destSub: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 12,
    color: MUTE,
    marginTop: 2,
  },
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
