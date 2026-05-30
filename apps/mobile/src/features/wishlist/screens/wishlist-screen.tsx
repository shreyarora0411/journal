import { Eyebrow, Page, StatusSpace } from '@/components';
import { log } from '@/lib/log';
import { useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { type WishlistToggleRow, useWishlistRows } from '../api/use-wishlist-toggle';

const INK = '#1A1410';
const MUTE = '#7A716A';
const HAIR = '#EFEAE2';
const CORAL = '#FF4D2E';

/**
 * Minimal wishlist surface. Lists destinations the user has tapped
 * "+ Plan" on, with their stashed venues nested underneath. Pilot
 * scope: read-only view; tap → destination page (where the +Plan and
 * Stash toggles live).
 */
export function WishlistScreen() {
  const router = useRouter();
  const q = useWishlistRows();

  useEffect(() => {
    log.event('wishlist.screen_entered');
  }, []);

  const tree = useMemo(() => {
    const rows = q.data ?? [];
    const parents = rows.filter((r) => r.parent_wishlist_item_id === null);
    return parents.map((parent) => ({
      parent,
      children: rows.filter((r) => r.parent_wishlist_item_id === parent.id),
    }));
  }, [q.data]);

  return (
    <Page>
      <StatusSpace />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        onPress={() => router.back()}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        style={{ alignSelf: 'flex-start', marginBottom: 8 }}
      >
        <Text style={styles.backGlyph}>‹</Text>
      </Pressable>
      <Eyebrow>My plan</Eyebrow>
      <Text style={styles.headline}>What's next.</Text>

      {q.isLoading ? (
        <Text style={styles.empty}>Loading…</Text>
      ) : tree.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Nothing stashed yet</Text>
          <Text style={styles.emptyBody}>
            Tap "+ Plan" on a destination, or "Stash" on a recommendation. They'll show up here.
          </Text>
        </View>
      ) : (
        <View style={{ marginTop: 16, gap: 14 }}>
          {tree.map(({ parent, children }) => (
            <View key={parent.id} style={styles.destCard}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={parent.target_label ?? 'Destination'}
                onPress={() =>
                  parent.target_external_id
                    ? router.push(`/(tabs)/destination/${parent.target_external_id}` as never)
                    : undefined
                }
              >
                <Text style={styles.destName}>{parent.target_label}</Text>
              </Pressable>
              {children.length > 0 ? (
                <View style={styles.childList}>
                  {children.map((c: WishlistToggleRow) => (
                    <View key={c.id} style={styles.childRow}>
                      <View style={styles.bullet} />
                      <Text style={styles.childLabel}>{c.target_label}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          ))}
        </View>
      )}
    </Page>
  );
}

const styles = StyleSheet.create({
  backGlyph: {
    fontFamily: 'PlayfairDisplay_500Medium',
    fontSize: 26,
    lineHeight: 26,
    color: INK,
  },
  headline: {
    fontFamily: 'PlayfairDisplay_500Medium',
    fontSize: 40,
    lineHeight: 44,
    color: INK,
    letterSpacing: -1,
    marginTop: 8,
  },
  empty: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: MUTE, marginTop: 24 },
  emptyCard: {
    marginTop: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: HAIR,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
  },
  emptyTitle: {
    fontFamily: 'PlayfairDisplay_500Medium',
    fontSize: 22,
    color: INK,
    letterSpacing: -0.4,
  },
  emptyBody: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    lineHeight: 20,
    color: MUTE,
    marginTop: 8,
  },
  destCard: {
    borderWidth: 1,
    borderColor: HAIR,
    borderRadius: 16,
    padding: 16,
    backgroundColor: '#FFFFFF',
  },
  destName: {
    fontFamily: 'PlayfairDisplay_500Medium',
    fontSize: 26,
    color: INK,
    letterSpacing: -0.5,
  },
  childList: { marginTop: 10, gap: 6 },
  childRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bullet: { width: 4, height: 4, borderRadius: 2, backgroundColor: CORAL },
  childLabel: { fontFamily: 'DMSans_400Regular', fontSize: 14, color: INK },
});
