import { Eyebrow, Face, Page, StatusSpace } from '@/components';
import { useToast } from '@/hooks/use-toast';
import { log } from '@/lib/log';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  type AskRequest,
  useCreateRequest,
  useInboxRequests,
  useMyVouches,
  useRespondToRequest,
  useSentRequests,
} from '../api/use-ask';

// Punctuation-insensitive destination compare, mirroring the DB's norm_search
// (migration 46): lowercase, fold non-alphanumeric runs to a space, trim. A
// vouch is "for" a request's destination if either name contains the other,
// so "Bangkok" matches a vouch stored as "Bangkok, Thailand".
const norm = (t: string) =>
  t
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
const destMatches = (a: string, b: string) => {
  const na = norm(a);
  const nb = norm(b);
  return na.length > 0 && nb.length > 0 && (na.includes(nb) || nb.includes(na));
};

const CORAL = '#FF4D2E';
const INK = '#1A1410';
const MUTE = '#7A716A';
const FAINT = '#B7AE9F';
const HAIR = '#EFEAE2';
const TINT = '#FAF6F0';

/**
 * Ask your circle (Loop C). With a sparse seed graph, passive search returns
 * thin results — Ask generates targeted supply on demand. Treated as a peer
 * to Search (v3 §3).
 *
 * Compose a request (destination + what you want), see your sent asks, and
 * answer incoming asks from your circle inline with a voiced response.
 */
export function AskScreen() {
  const router = useRouter();
  const toast = useToast();
  const create = useCreateRequest();
  const respond = useRespondToRequest();
  const sent = useSentRequests();
  const inbox = useInboxRequests();
  const myVouches = useMyVouches();

  // Seed the destination from the search screen's empty-state CTA, so a
  // searcher who found nothing doesn't have to re-type the place.
  const params = useLocalSearchParams<{ destination?: string }>();
  const [destination, setDestination] = useState(params.destination ?? '');
  const [text, setText] = useState('');
  // Per-inbox-request draft answer, keyed by request id.
  const [answers, setAnswers] = useState<Record<string, string>>({});
  // Per-inbox-request attached vouch id (optional), keyed by request id.
  const [pickedVouch, setPickedVouch] = useState<Record<string, string | null>>({});

  useEffect(() => {
    log.event('ask.screen_entered');
  }, []);

  const canAsk = destination.trim().length > 0 && text.trim().length > 0;

  const onAsk = async () => {
    if (!canAsk) {
      toast.show({ message: 'Add a place and what you want to know.', variant: 'error' });
      return;
    }
    try {
      await create.mutateAsync({ destinationText: destination.trim(), requestText: text.trim() });
      setDestination('');
      setText('');
      toast.show({ message: 'Asked your circle.', variant: 'success' });
    } catch (err) {
      log.error('create ask failed', err);
      toast.show({ message: 'Could not send. Try again.', variant: 'error' });
    }
  };

  const onRespond = async (req: AskRequest) => {
    const body = (answers[req.id] ?? '').trim();
    const vouchId = pickedVouch[req.id] ?? undefined;
    // A reply needs voiced words or an attached vouch (mirrors the DB's
    // rec_resp_has_content check). Text stays the primary signal.
    if (body.length === 0 && !vouchId) {
      toast.show({ message: 'Say something, or attach a vouch.', variant: 'error' });
      return;
    }
    try {
      await respond.mutateAsync({ requestId: req.id, text: body || undefined, vouchId });
      setAnswers((p) => ({ ...p, [req.id]: '' }));
      setPickedVouch((p) => ({ ...p, [req.id]: null }));
      toast.show({ message: 'Sent your vouch.', variant: 'success' });
    } catch (err) {
      log.error('respond failed', err);
      toast.show({ message: 'Could not send. Try again.', variant: 'error' });
    }
  };

  return (
    <Page>
      <StatusSpace />
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => router.back()}
          hitSlop={8}
        >
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>
        <Text style={styles.headline}>Ask your circle.</Text>
        <Text style={styles.sub}>Going somewhere? Get vouches from the people you trust.</Text>

        {/* Compose */}
        <View style={styles.field}>
          <Eyebrow>Where to?</Eyebrow>
          <TextInput
            accessibilityLabel="Ask destination"
            placeholder="Spiti, Bangkok, Goa…"
            placeholderTextColor={FAINT}
            value={destination}
            onChangeText={setDestination}
            style={styles.input}
            selectionColor={CORAL}
          />
        </View>
        <View style={styles.field}>
          <Eyebrow>What do you want to know?</Eyebrow>
          <View style={styles.card}>
            <TextInput
              accessibilityLabel="Ask text"
              placeholder="Couple, 4 nights — where to stay and eat?"
              placeholderTextColor={FAINT}
              value={text}
              onChangeText={(v) => setText(v.slice(0, 500))}
              multiline
              style={styles.cardInput}
              selectionColor={CORAL}
            />
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Send ask"
          onPress={onAsk}
          disabled={!canAsk || create.isPending}
          style={[styles.cta, (!canAsk || create.isPending) && { opacity: 0.5 }]}
        >
          {create.isPending ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.ctaLabel}>Ask your circle</Text>
          )}
        </Pressable>

        {/* Asks for you (inbox) */}
        {(inbox.data ?? []).length > 0 ? (
          <View style={{ marginTop: 32, gap: 12 }}>
            <Eyebrow>Asks for you</Eyebrow>
            {(inbox.data ?? []).map((req) => {
              const who = req.requester?.display_name ?? req.requester?.handle ?? 'Someone';
              // Your own vouches that match where they're asking about — the
              // optional pool to attach. Free text stays the primary answer.
              const mine = (myVouches.data ?? []).filter((v) =>
                destMatches(v.destination_text, req.destination_text),
              );
              return (
                <View key={req.id} style={styles.askCard}>
                  <View style={styles.askHead}>
                    <Face
                      uri={req.requester?.avatar_url ?? null}
                      initials={who.slice(0, 2).toUpperCase()}
                      size="sm"
                    />
                    <Text style={styles.askWho}>
                      {who} · {req.destination_text}
                    </Text>
                  </View>
                  <Text style={styles.askText}>"{req.request_text}"</Text>
                  <View style={styles.answerRow}>
                    <TextInput
                      accessibilityLabel={`Answer ${who}`}
                      placeholder="Your vouch — one place, worth it or not"
                      placeholderTextColor={FAINT}
                      value={answers[req.id] ?? ''}
                      onChangeText={(v) => setAnswers((p) => ({ ...p, [req.id]: v.slice(0, 500) }))}
                      style={styles.answerInput}
                      selectionColor={CORAL}
                    />
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Send answer to ${who}`}
                      onPress={() => onRespond(req)}
                      style={styles.answerSend}
                    >
                      <Text style={styles.answerSendLabel}>Send</Text>
                    </Pressable>
                  </View>
                  {mine.length > 0 ? (
                    <View style={styles.attachWrap}>
                      <Text style={styles.attachLabel}>Attach one of your vouches (optional)</Text>
                      <View style={styles.chipRow}>
                        {mine.map((v) => {
                          const on = pickedVouch[req.id] === v.id;
                          return (
                            <Pressable
                              key={v.id}
                              accessibilityRole="button"
                              accessibilityState={{ selected: on }}
                              accessibilityLabel={`${on ? 'Remove attached vouch' : 'Attach vouch'}: ${v.text}`}
                              onPress={() =>
                                setPickedVouch((p) => ({ ...p, [req.id]: on ? null : v.id }))
                              }
                              style={[styles.chip, on && styles.chipOn]}
                            >
                              <Text
                                style={[styles.chipText, on && styles.chipTextOn]}
                                numberOfLines={1}
                              >
                                {on ? '✓ ' : ''}
                                {v.text}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        ) : null}

        {/* Your asks */}
        {(sent.data ?? []).length > 0 ? (
          <View style={{ marginTop: 32, gap: 12 }}>
            <Eyebrow color={MUTE}>Your asks</Eyebrow>
            {(sent.data ?? []).map((req) => (
              <Pressable
                key={req.id}
                accessibilityRole="button"
                accessibilityLabel={`Your ask about ${req.destination_text}`}
                onPress={() => router.push(`/(tabs)/ask/${req.id}` as never)}
                style={styles.sentCard}
              >
                <Text style={styles.sentDest}>{req.destination_text}</Text>
                <Text style={styles.sentText} numberOfLines={2}>
                  "{req.request_text}"
                </Text>
                <Text style={styles.sentMeta}>TAP TO SEE REPLIES ›</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        <View style={{ height: 48 }} />
      </ScrollView>
    </Page>
  );
}

const styles = StyleSheet.create({
  back: { fontFamily: 'DMSans_600SemiBold', fontSize: 14, color: MUTE, marginTop: 4 },
  headline: {
    fontFamily: 'PlayfairDisplay_500Medium',
    fontSize: 32,
    lineHeight: 36,
    color: INK,
    letterSpacing: -0.6,
    marginTop: 8,
  },
  sub: { fontFamily: 'DMSans_400Regular', fontSize: 14, lineHeight: 20, color: MUTE, marginTop: 6 },
  field: { marginTop: 22 },
  input: {
    marginTop: 8,
    fontFamily: 'DMSans_400Regular',
    fontSize: 17,
    color: INK,
    borderBottomWidth: 1,
    borderBottomColor: HAIR,
    paddingVertical: 8,
  },
  card: {
    marginTop: 8,
    backgroundColor: TINT,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: HAIR,
    padding: 12,
    minHeight: 64,
  },
  cardInput: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 15.5,
    lineHeight: 22,
    color: INK,
    minHeight: 40,
    textAlignVertical: 'top',
  },
  cta: {
    backgroundColor: INK,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  ctaLabel: { fontFamily: 'DMSans_600SemiBold', fontSize: 16, color: '#FFFFFF' },
  askCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: HAIR,
    padding: 14,
  },
  askHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  askWho: { fontFamily: 'DMSans_600SemiBold', fontSize: 14, color: INK },
  askText: {
    fontFamily: 'PlayfairDisplay_500Medium_Italic',
    fontSize: 16,
    lineHeight: 23,
    color: INK,
    marginTop: 10,
  },
  answerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  answerInput: {
    flex: 1,
    backgroundColor: TINT,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: HAIR,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    color: INK,
  },
  answerSend: {
    backgroundColor: CORAL,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  answerSendLabel: { fontFamily: 'DMSans_600SemiBold', fontSize: 14, color: '#FFFFFF' },
  attachWrap: { marginTop: 12, gap: 8 },
  attachLabel: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 11,
    letterSpacing: 0.3,
    color: FAINT,
    textTransform: 'uppercase',
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    maxWidth: '100%',
    backgroundColor: TINT,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: HAIR,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipOn: { backgroundColor: 'rgba(255, 77, 46, 0.10)', borderColor: CORAL },
  chipText: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: MUTE },
  chipTextOn: { fontFamily: 'DMSans_600SemiBold', color: CORAL },
  sentCard: {
    backgroundColor: TINT,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: HAIR,
    padding: 14,
  },
  sentDest: {
    fontFamily: 'PlayfairDisplay_500Medium',
    fontSize: 18,
    color: INK,
    letterSpacing: -0.4,
  },
  sentText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    lineHeight: 20,
    color: MUTE,
    marginTop: 4,
  },
  sentMeta: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 10,
    letterSpacing: 1,
    color: FAINT,
    marginTop: 10,
  },
});
