import { Face, Page, StatusSpace } from '@/components';
import { log } from '@/lib/log';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRequestResponses, useSentRequests } from '../api/use-ask';

const INK = '#1A1410';
const MUTE = '#7A716A';
const FAINT = '#B7AE9F';
const HAIR = '#EFEAE2';
const TINT = '#FAF6F0';

/** The response thread for one of the user's own asks. */
export function AskThreadScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const sent = useSentRequests();
  const responses = useRequestResponses(id ?? null);

  useEffect(() => {
    log.event('ask.thread_entered', { id });
  }, [id]);

  const req = useMemo(() => (sent.data ?? []).find((r) => r.id === id) ?? null, [sent.data, id]);
  const rows = responses.data ?? [];

  return (
    <Page>
      <StatusSpace />
      <ScrollView showsVerticalScrollIndicator={false}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} hitSlop={8}>
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>

        {req ? (
          <>
            <Text style={styles.dest}>{req.destination_text}</Text>
            <Text style={styles.ask}>"{req.request_text}"</Text>
          </>
        ) : (
          <Text style={styles.dest}>Your ask</Text>
        )}

        <View style={styles.rule} />

        {responses.isLoading ? (
          <Text style={styles.empty}>Loading replies…</Text>
        ) : rows.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No replies yet.</Text>
            <Text style={styles.emptyBody}>
              Your circle will see this and can vouch. Nudge a friend who's been.
            </Text>
          </View>
        ) : (
          <View style={{ gap: 12, marginTop: 4 }}>
            {rows.map((r) => {
              const who = r.responder?.display_name ?? r.responder?.handle ?? 'Someone';
              return (
                <View key={r.id} style={styles.replyCard}>
                  <View style={styles.replyHead}>
                    <Face uri={r.responder?.avatar_url ?? null} initials={who.slice(0, 2).toUpperCase()} size="sm" />
                    <Text style={styles.replyWho}>{who}</Text>
                  </View>
                  {r.text ? <Text style={styles.replyText}>"{r.text}"</Text> : null}
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
  dest: {
    fontFamily: 'PlayfairDisplay_500Medium',
    fontSize: 30,
    color: INK,
    letterSpacing: -0.6,
    marginTop: 8,
  },
  ask: {
    fontFamily: 'PlayfairDisplay_500Medium_Italic',
    fontSize: 17,
    lineHeight: 24,
    color: MUTE,
    marginTop: 8,
  },
  rule: { height: 1, backgroundColor: HAIR, marginVertical: 18 },
  empty: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: MUTE },
  emptyCard: {
    padding: 18,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: HAIR,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
  },
  emptyTitle: { fontFamily: 'PlayfairDisplay_500Medium', fontSize: 20, color: INK },
  emptyBody: { fontFamily: 'DMSans_400Regular', fontSize: 13, lineHeight: 20, color: MUTE, marginTop: 6 },
  replyCard: { backgroundColor: TINT, borderRadius: 14, borderWidth: 1, borderColor: HAIR, padding: 14 },
  replyHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  replyWho: { fontFamily: 'DMSans_600SemiBold', fontSize: 14, color: INK },
  replyText: {
    fontFamily: 'PlayfairDisplay_500Medium_Italic',
    fontSize: 16,
    lineHeight: 23,
    color: INK,
    marginTop: 10,
  },
});
