import { Wordmark } from '@/components/Wordmark';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const RULES = [
  {
    title: 'Read it like a friend.',
    body: 'A note here means a friend loved the place enough to tell you. Take it as their word, not a star rating.',
  },
  {
    title: 'Log honestly.',
    body: "If a place was just fine, say fine — your map is only worth borrowing when it's true.",
  },
  {
    title: 'Share what helps.',
    body: "Send a place to the friend who needs it — that's what Vouch is for. Just carry the trust it came with when you pass it on.",
  },
];

export function HouseRulesScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.backGlyph}>‹</Text>
        </Pressable>
        <Wordmark size="sm" color="#1A1A1A" />
        <View style={{ width: 24 }} />
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.title}>House rules</Text>
        <Text style={styles.intro}>
          Vouch works because you only hear from people whose taste you'd actually borrow. Three
          rules keep it that way.
        </Text>
        {RULES.map((r) => (
          <View key={r.title} style={styles.rule}>
            <Text style={styles.ruleTitle}>{r.title}</Text>
            <Text style={styles.ruleBody}>{r.body}</Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 8,
  },
  backGlyph: { fontFamily: 'Fraunces_400', fontSize: 24, color: '#1A1A1A', width: 24 },
  body: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 32, gap: 20 },
  title: {
    fontFamily: 'Fraunces_400Italic',
    fontSize: 32,
    lineHeight: 38,
    color: '#1A1A1A',
  },
  intro: {
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    lineHeight: 24,
    color: '#5A5A5A',
  },
  rule: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    gap: 6,
  },
  ruleTitle: {
    fontFamily: 'Fraunces_400Italic',
    fontSize: 20,
    color: '#1A1A1A',
  },
  ruleBody: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 22,
    color: '#5A5A5A',
  },
});
