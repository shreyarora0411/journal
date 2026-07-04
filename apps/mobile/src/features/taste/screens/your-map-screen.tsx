import { Eyebrow, Face, Icon, Page, StatusSpace } from '@/components';
import { useProfile } from '@/features/auth';
import { TASTE_TUNING } from '@journal/shared';
import { hubLabel } from '@journal/shared';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { type MyPlaceRow, useMyPlaces, useMyPriors, useMyTaste } from '../api/use-taste-data';
import { LoadError } from '../components/LoadError';

const CORAL = '#FF4D2E';
const INK = '#1B1714';
const MUTE = '#8A8178';
const HAIR = '#E7E1D7';
const CARD = '#FFFDFA';

const SERIF = 'Fraunces_500';
const SERIF_IT = 'Fraunces_400Italic';
const SANS = 'HankenGrotesk_400Regular';
const SANS_SEMI = 'HankenGrotesk_600SemiBold';
const SANS_BOLD = 'HankenGrotesk_700Bold';

const SENTIMENT_LABEL: Record<string, string> = {
  loved: 'Loved',
  fine: 'Fine',
  skip: 'Skip',
};

/**
 * Your Map — home + identity (spec §3, screen 1). The make-or-break surface:
 * it must beat a Notes list as a personal artifact, because it's what makes
 * people log before the network exists. Leads with the derived taste read-out
 * (identity), then the living list of logged places. Sentiment shown here is
 * the viewer's own — it is PRIVATE everywhere else.
 */
export function YourMapScreen() {
  const router = useRouter();
  const profile = useProfile();
  const tasteQ = useMyTaste();
  const placesQ = useMyPlaces();
  const priorsQ = useMyPriors();

  const places = placesQ.data ?? [];
  const lovedCount = useMemo(() => places.filter((p) => p.sentiment === 'loved').length, [places]);
  const gate = TASTE_TUNING.confidenceMinLoves;
  const readout = tasteQ.data?.readout ?? [];

  const displayName = profile.data?.display_name ?? 'Your map';

  return (
    <Page>
      <StatusSpace />

      <View style={styles.header}>
        <Text accessibilityLabel="Vouch." style={styles.wordmark}>
          Vouch<Text style={{ color: CORAL }}>.</Text>
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Your profile"
          onPress={() => router.push('/(tabs)/you' as never)}
        >
          <Face initials={displayName.slice(0, 2).toUpperCase()} size="sm" />
        </Pressable>
      </View>

      {/* Identity block — the taste readout, derived, never self-declared.
          Never assert "0 loves" while loading or on error: a flaky open
          must not read like an empty life. */}
      <View style={{ marginTop: 18 }}>
        <Text style={styles.eyebrowGold}>YOUR TASTE</Text>
        {tasteQ.isLoading || placesQ.isLoading ? (
          <Text style={styles.readoutPrompt}>…</Text>
        ) : tasteQ.isError || placesQ.isError ? null : (
          <>
            {readout.length > 0 ? (
              <Text style={styles.readout}>{readout.join(' · ')}.</Text>
            ) : lovedCount > 0 ? (
              // tasteReadout only names axes with a clear lean (±0.25) — a
              // few loves can sit near-neutral and legitimately produce
              // nothing to say yet. Never claim they haven't logged.
              <Text style={styles.readoutPrompt}>
                Your taste is still finding its shape — a few more loves will sharpen it.
              </Text>
            ) : (
              <Text style={styles.readoutPrompt}>
                Log a few places you love and your taste takes shape here.
              </Text>
            )}
            {lovedCount < gate ? (
              <Text style={styles.gateLine}>
                {lovedCount}/{gate} loves — {gate - lovedCount} more and we’ll know whose taste fits
                yours.
              </Text>
            ) : null}
          </>
        )}
      </View>

      {/* Log CTA — the single most important action on an empty map. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Log a place"
        onPress={() => router.push('/(tabs)/add' as never)}
        style={styles.logCta}
      >
        <Icon name="plus" size={16} color="#FFFFFF" />
        <Text style={styles.logCtaLabel}>Log a place</Text>
      </Pressable>

      {/* Re-entry door: the quiz was skippable — keep it reachable until
          priors exist (it stops rendering the moment they do). */}
      {places.length > 0 && !priorsQ.isLoading && !priorsQ.data ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Finish your taste setup"
          onPress={() => router.push('/(tabs)/taste-setup' as never)}
          style={styles.setupNudge}
        >
          <Text style={styles.setupNudgeText}>
            Finish your taste setup — four quick calls sharpen your map. ›
          </Text>
        </Pressable>
      ) : null}

      {/* The map — every place you've logged, newest first. */}
      <View style={{ marginTop: 28, marginBottom: 80 }}>
        <Eyebrow>Your places</Eyebrow>
        {placesQ.isLoading ? (
          <Text style={styles.empty}>Loading…</Text>
        ) : placesQ.isError ? (
          <LoadError message="Couldn't load your map." onRetry={() => placesQ.refetch()} />
        ) : places.length === 0 ? (
          // Quiz already done → the missing thing is a first log, not a
          // second quiz (which would overwrite saved priors).
          priorsQ.data ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Log a place"
              onPress={() => router.push('/(tabs)/add' as never)}
              style={styles.emptyCard}
            >
              <Text style={styles.emptyTitle}>Nothing logged yet.</Text>
              <Text style={styles.emptyBody}>
                Your taste setup is in — now log the first place you love and your map begins.
              </Text>
              <Text style={styles.emptyCta}>Log a place ›</Text>
            </Pressable>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Set up your taste"
              onPress={() => router.push('/(tabs)/taste-setup' as never)}
              style={styles.emptyCard}
            >
              <Text style={styles.emptyTitle}>Nothing logged yet.</Text>
              <Text style={styles.emptyBody}>
                Two minutes: four quick calls, then the five places that are so you — and your taste
                is live.
              </Text>
              <Text style={styles.emptyCta}>Set up your taste ›</Text>
            </Pressable>
          )
        ) : (
          <View style={{ gap: 8, marginTop: 12 }}>
            {places.map((row: MyPlaceRow) =>
              row.place ? (
                <Pressable
                  key={row.place.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${row.place.name}`}
                  onPress={() => router.push(`/(tabs)/spot/${row.place?.id}` as never)}
                  style={styles.row}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.rowName} numberOfLines={1}>
                      {row.place.name}
                    </Text>
                    <Text style={styles.rowMeta} numberOfLines={1}>
                      {[hubLabel(row.place.hub), row.place.zone].filter(Boolean).join(' · ') || '—'}
                    </Text>
                    {row.note ? (
                      <Text style={styles.rowNote} numberOfLines={2}>
                        “{row.note}”
                      </Text>
                    ) : null}
                  </View>
                  <View
                    style={[
                      styles.sentimentChip,
                      row.sentiment === 'loved' && styles.sentimentLoved,
                      row.sentiment === 'skip' && styles.sentimentSkip,
                    ]}
                  >
                    <Text
                      style={[
                        styles.sentimentText,
                        row.sentiment === 'loved' && { color: '#FFFFFF' },
                      ]}
                    >
                      {SENTIMENT_LABEL[row.sentiment]}
                    </Text>
                  </View>
                </Pressable>
              ) : null,
            )}
          </View>
        )}
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
  },
  wordmark: { fontFamily: SERIF, fontSize: 26, color: INK, letterSpacing: -0.5 },
  eyebrowGold: { fontFamily: SANS_BOLD, fontSize: 10, letterSpacing: 1.6, color: '#C8A24A' },
  readout: {
    fontFamily: SERIF,
    fontSize: 22,
    lineHeight: 29,
    color: INK,
    letterSpacing: -0.3,
    marginTop: 6,
  },
  readoutPrompt: { fontFamily: SANS, fontSize: 14, lineHeight: 21, color: MUTE, marginTop: 6 },
  gateLine: { fontFamily: SANS_SEMI, fontSize: 12.5, color: CORAL, marginTop: 8 },
  logCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 20,
    backgroundColor: CORAL,
    borderRadius: 14,
    paddingVertical: 14,
  },
  logCtaLabel: { fontFamily: SANS_SEMI, fontSize: 15, color: '#FFFFFF' },
  setupNudge: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: HAIR,
    backgroundColor: CARD,
  },
  setupNudgeText: { fontFamily: SANS_SEMI, fontSize: 13, color: MUTE },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: HAIR,
    backgroundColor: CARD,
  },
  rowName: { fontFamily: SANS_SEMI, fontSize: 15, color: INK },
  rowMeta: {
    fontFamily: SANS_BOLD,
    fontSize: 10.5,
    letterSpacing: 0.6,
    color: MUTE,
    textTransform: 'uppercase',
    marginTop: 3,
  },
  rowNote: {
    fontFamily: SERIF_IT,
    fontSize: 14.5,
    lineHeight: 21,
    color: INK,
    marginTop: 6,
  },
  sentimentChip: {
    borderWidth: 1,
    borderColor: HAIR,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  sentimentLoved: { backgroundColor: CORAL, borderColor: CORAL },
  sentimentSkip: { backgroundColor: '#F2E2D2', borderColor: '#F2E2D2' },
  sentimentText: { fontFamily: SANS_SEMI, fontSize: 11.5, color: MUTE },
  empty: { fontFamily: SANS, fontSize: 13, color: MUTE, marginTop: 14 },
  emptyCard: {
    marginTop: 14,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: HAIR,
    backgroundColor: CARD,
  },
  emptyTitle: { fontFamily: SERIF, fontSize: 22, color: INK, letterSpacing: -0.4 },
  emptyBody: { fontFamily: SANS, fontSize: 13, lineHeight: 20, color: MUTE, marginTop: 8 },
  emptyCta: { fontFamily: SANS_SEMI, fontSize: 14, color: CORAL, marginTop: 14 },
});
