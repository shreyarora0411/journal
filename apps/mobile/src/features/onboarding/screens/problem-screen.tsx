import { Box, Button, Text } from '@/components';
import { log } from '@/lib/log';
import type { Theme } from '@/theme';
import { useTheme } from '@shopify/restyle';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const bubbles: { side: 'out' | 'in'; text: string; opacity?: number }[] = [
  { side: 'out', text: 'Going to Goa next week, where to stay?' },
  { side: 'in', text: "Try Tito's" },
  { side: 'in', text: "Tito's is over. Try Anjuna" },
  { side: 'in', text: 'Actually Assagao not Anjuna' },
  { side: 'out', text: 'Wait who else has been recently?' },
  // Trailing fade — design pack shows a dimming "…" bubble to suggest the chat
  // continues offscreen. Empty text + ellipsis glyph is enough.
  { side: 'out', text: '…', opacity: 0.45 },
];

export default function ProblemScreen() {
  const router = useRouter();
  const theme = useTheme<Theme>();

  useEffect(() => {
    log.event('onboarding.screen_entered', { screen: 'problem' });
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FAF8F3' }}>
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 24, flexGrow: 1 }}>
        <Text variant="caption">Most trips begin like this…</Text>
        <View style={{ gap: 6, marginTop: 16 }}>
          {bubbles.map((b, i) => (
            <View
              key={`${b.side}-${i}`}
              style={{
                alignSelf: b.side === 'out' ? 'flex-end' : 'flex-start',
                backgroundColor: b.side === 'out' ? theme.colors.bubbleOut : theme.colors.bubbleIn,
                paddingHorizontal: 13,
                paddingVertical: 9,
                borderRadius: 14,
                borderBottomRightRadius: b.side === 'out' ? 4 : 14,
                borderBottomLeftRadius: b.side === 'in' ? 4 : 14,
                maxWidth: '78%',
                opacity: b.opacity ?? 1,
              }}
            >
              <Text
                style={{
                  color: b.side === 'out' ? theme.colors.bubbleOutText : theme.colors.bubbleInText,
                  fontSize: 13,
                  fontFamily: 'Inter_400Regular',
                }}
              >
                {b.text}
              </Text>
            </View>
          ))}
        </View>

        <Box marginTop="xl">
          <Text variant="title">The recs are already in your phone.</Text>
          <Text variant="caption" marginTop="s">
            We just made them findable.
          </Text>
        </Box>

        <Box marginTop="xl">
          <Button
            label="Continue"
            onPress={() => router.push('/(auth)/promise' as never)}
            fullWidth
            size="lg"
          />
        </Box>
      </ScrollView>
    </SafeAreaView>
  );
}
