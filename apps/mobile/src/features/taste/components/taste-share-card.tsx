import { VoicedNote, Wordmark } from '@/components';
import { TASTE_AXES, type TasteAxes, type TasteAxis } from '@journal/shared';
import { useRef, useState } from 'react';
import { Modal, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import ViewShot from 'react-native-view-shot';
import {
  CARD,
  CORAL,
  HAIR,
  INK,
  MUTE,
  SANS,
  SANS_BOLD,
  SANS_SEMI,
  SERIF_IT,
  TASTE_TYPE_SCALE,
  TINT,
} from '../lib/taste-tokens';

// 9:16 story/WhatsApp-status shape — the one size that reads cleanly on
// every share surface without the OS cropping it awkwardly.
const CARD_WIDTH = 360;
const CARD_HEIGHT = 640;

// Purely a caption for the bar chart below — not canonical vocabulary (that
// lives in tasteReadout's LEAN_LABELS, private to packages/shared/taste.ts).
const AXIS_CAPTIONS: Record<TasteAxis, string> = {
  substance_scene: 'Substance — Scene',
  mellow_lively: 'Mellow — Lively',
  adventurous_trusty: 'New — Proven',
  refined_unfussy: 'Refined — Unfussy',
  value_splurge: 'Value — Splurge',
};

export type TasteShareCardPlace = {
  name: string;
  note: string | null;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  axes: TasteAxes;
  readout: string[];
  lovedCount: number;
  hubCount: number;
  places: TasteShareCardPlace[];
  inviteText: string;
};

/**
 * The single shareable growth artifact (spec: one 9:16 "taste card" reachable
 * from You). ViewShot wraps the fixed-size card so its ref's capture() can
 * hand a local file URI straight to Share.share — no expo-sharing needed,
 * iOS accepts a local file image `url` directly in the share sheet.
 */
export function TasteShareCard({
  visible,
  onClose,
  axes,
  readout,
  lovedCount,
  hubCount,
  places,
  inviteText,
}: Props) {
  // v4 (the SDK 54-pinned release) types the ref as the ViewShot class
  // itself; capture() is optional on it, hence the ?. below.
  const shotRef = useRef<ViewShot>(null);
  const [sharing, setSharing] = useState(false);

  const notedPlaces = places.filter((p) => p.note !== null);
  const shownPlaces = (notedPlaces.length > 0 ? notedPlaces : places).slice(0, 3);

  const onShare = async () => {
    if (sharing) return;
    setSharing(true);
    try {
      const uri = await shotRef.current?.capture?.();
      if (!uri) return;
      await Share.share({ url: uri, message: inviteText });
    } catch {
      // Capture/share can fail for mundane reasons (user dismissed the
      // sheet, no disk space); nothing the user needs an error toast for.
    } finally {
      setSharing(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <ViewShot ref={shotRef} options={{ format: 'png', quality: 1 }}>
            <View style={styles.card}>
              <Wordmark size="sm" />

              {readout.length > 0 ? (
                <Text style={styles.readout} maxFontSizeMultiplier={1.3}>
                  {readout.join(' · ')}.
                </Text>
              ) : (
                <Text style={styles.readoutPrompt} maxFontSizeMultiplier={1.3}>
                  Still finding its shape.
                </Text>
              )}

              <View style={styles.axesBlock}>
                {TASTE_AXES.map((axis) => {
                  const v = axes[axis] ?? 0;
                  const pct = ((v + 1) / 2) * 100;
                  return (
                    <View key={axis} style={styles.axisRow}>
                      <Text style={styles.axisCaption}>{AXIS_CAPTIONS[axis]}</Text>
                      <View style={styles.axisTrack}>
                        <View style={[styles.axisDot, { left: `${pct}%` }]} />
                      </View>
                    </View>
                  );
                })}
              </View>

              <Text style={styles.stats} maxFontSizeMultiplier={1.3}>
                {lovedCount} love{lovedCount === 1 ? '' : 's'} · {hubCount} neighbourhood
                {hubCount === 1 ? '' : 's'}
              </Text>

              {shownPlaces.length > 0 ? (
                <View style={styles.places}>
                  {shownPlaces.map((p) => (
                    <View key={p.name} style={styles.placeRow}>
                      <Text style={styles.placeName} numberOfLines={1} maxFontSizeMultiplier={1.3}>
                        {p.name}
                      </Text>
                      {p.note ? (
                        <VoicedNote
                          note={p.note}
                          size="sm"
                          numberOfLines={2}
                          style={styles.placeNote}
                          maxFontSizeMultiplier={1.3}
                        />
                      ) : null}
                    </View>
                  ))}
                </View>
              ) : null}

              <Text style={styles.invite} numberOfLines={2} maxFontSizeMultiplier={1.3}>
                {inviteText}
              </Text>
            </View>
          </ViewShot>

          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Share to..."
              onPress={onShare}
              disabled={sharing}
              style={styles.shareBtn}
            >
              <Text style={styles.shareBtnLabel}>{sharing ? 'Preparing…' : 'Share to…'}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={onClose}
              style={styles.closeBtn}
            >
              <Text style={styles.closeBtnLabel}>Close</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(27, 23, 20, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sheet: { alignItems: 'center', gap: 16 },
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: HAIR,
    backgroundColor: CARD,
    padding: 24,
  },
  readout: {
    fontFamily: SERIF_IT,
    fontSize: TASTE_TYPE_SCALE.headlineLg,
    lineHeight: 29,
    color: INK,
    letterSpacing: -0.3,
    marginTop: 18,
  },
  readoutPrompt: {
    fontFamily: SANS,
    fontSize: TASTE_TYPE_SCALE.subhead,
    lineHeight: 20,
    color: MUTE,
    marginTop: 18,
  },
  axesBlock: { marginTop: 22, gap: 10 },
  axisRow: { gap: 4 },
  axisCaption: {
    fontFamily: SANS_SEMI,
    fontSize: 9.5,
    letterSpacing: 0.4,
    color: MUTE,
    textTransform: 'uppercase',
  },
  axisTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: HAIR,
    position: 'relative',
  },
  axisDot: {
    position: 'absolute',
    top: -3,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: CORAL,
    marginLeft: -5,
  },
  stats: {
    fontFamily: SANS_SEMI,
    fontSize: TASTE_TYPE_SCALE.body,
    color: MUTE,
    marginTop: 20,
  },
  places: { marginTop: 16, gap: 10 },
  placeRow: {
    padding: 10,
    borderRadius: 10,
    backgroundColor: TINT,
  },
  placeName: { fontFamily: SANS_BOLD, fontSize: TASTE_TYPE_SCALE.body, color: INK },
  placeNote: { marginTop: 3 },
  invite: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 24,
    fontFamily: SANS,
    fontSize: TASTE_TYPE_SCALE.caption,
    lineHeight: 16,
    color: MUTE,
  },
  actions: { flexDirection: 'row', gap: 10 },
  shareBtn: {
    backgroundColor: CORAL,
    borderRadius: 999,
    paddingHorizontal: 22,
    paddingVertical: 12,
  },
  shareBtnLabel: { fontFamily: SANS_SEMI, fontSize: TASTE_TYPE_SCALE.subhead, color: '#FFFFFF' },
  closeBtn: {
    borderWidth: 1,
    borderColor: '#FFFFFF',
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  closeBtnLabel: { fontFamily: SANS_SEMI, fontSize: TASTE_TYPE_SCALE.subhead, color: '#FFFFFF' },
});
