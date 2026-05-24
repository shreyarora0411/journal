import {
  Button,
  Card,
  CategoryPill,
  Eyebrow,
  Face,
  FaceStack,
  Nav,
  Page,
  Photo,
  Pill,
  PullQuote,
  StatusSpace,
  type Verdict,
  VerdictPicker,
  Wordmark,
} from '@/components';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

/**
 * Dev-only gallery of the redesign primitives. Use this to QA the design
 * system before touching feature screens. Every primitive should render
 * correctly in every variant here.
 *
 * Route: `/dev/components`.
 */
export default function ComponentsPreviewScreen() {
  const router = useRouter();
  const [verdict, setVerdict] = useState<Verdict>('love');
  const [navSlot, setNavSlot] = useState<'feed' | 'search' | 'add' | 'inbox' | 'you'>('feed');

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <Page>
        <StatusSpace />

        <Section title="Wordmark">
          <View style={{ gap: 8 }}>
            <Wordmark size="sm" />
            <Wordmark size="md" />
            <Wordmark size="lg" />
            <Wordmark size="xl" />
          </View>
        </Section>

        <Section title="Eyebrow">
          <View style={{ gap: 8 }}>
            <Eyebrow>step 1 of 4</Eyebrow>
            <Eyebrow color="#FF3D87">from instagram</Eyebrow>
            <Eyebrow color="#00A67E">private to my circle</Eyebrow>
            <Eyebrow color="#FFB300">my 2026</Eyebrow>
          </View>
        </Section>

        <Section title="PullQuote">
          <PullQuote size="lg">
            The recs were already in my phone. I just couldn’t find them.
          </PullQuote>
          <View style={{ height: 12 }} />
          <PullQuote>
            Stay at Hotel K5, lean into the Nihonbashi side and walk the river at 6.
          </PullQuote>
        </Section>

        <Section title="Buttons">
          <View style={{ gap: 8 }}>
            <Button label="Get started" variant="primary" fullWidth size="lg" />
            <Button label="Pop 5 trips into my book →" variant="accent" fullWidth size="lg" />
            <Button label="Skip" variant="ghost" fullWidth />
          </View>
        </Section>

        <Section title="Pills">
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <Pill label="All 31" variant="on" onPress={() => undefined} />
            <Pill label="Filter" variant="default" onPress={() => undefined} />
            <Pill label="Live" variant="accent" onPress={() => undefined} />
          </View>
        </Section>

        <Section title="CategoryPill">
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <CategoryPill category="stay" />
            <CategoryPill category="food" />
            <CategoryPill category="drinks" />
            <CategoryPill category="wander" />
            <CategoryPill category="buy" />
          </View>
          <View style={{ height: 8 }} />
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <CategoryPill category="stay" variant="filled" />
            <CategoryPill category="food" variant="outlined" />
          </View>
        </Section>

        <Section title="Face">
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-end' }}>
            <Face initials="TA" size="xs" />
            <Face initials="KA" size="sm" />
            <Face initials="DI" size="md" />
            <Face initials="SR" size="lg" />
          </View>
        </Section>

        <Section title="FaceStack (max 3)">
          <FaceStack
            people={[
              { initials: 'TA' },
              { initials: 'KA' },
              { initials: 'DI' },
              { initials: 'AN' },
              { initials: 'PR' },
            ]}
            max={3}
            size="md"
          />
        </Section>

        <Section title="Photo">
          <Photo
            uri="https://images.unsplash.com/photo-1545569341-9eb8b30979d9?w=1200"
            aspectRatio={16 / 9}
            radius={14}
          />
        </Section>

        <Section title="Cards">
          <Card>
            <Text style={{ fontFamily: 'Geist_500Medium', color: '#1A1410' }}>
              Default card · white background, 1px hair border, 14px radius.
            </Text>
          </Card>
          <View style={{ height: 8 }} />
          <Card variant="tint">
            <Text style={{ fontFamily: 'Geist_400Regular', color: '#1A1410' }}>
              Tint card · sand background, no border.
            </Text>
          </Card>
        </Section>

        <Section title="VerdictPicker">
          <VerdictPicker value={verdict} onChange={setVerdict} />
          <View style={{ height: 6 }} />
          <Text style={{ fontFamily: 'Geist_400Regular', color: '#7A716A', fontSize: 12 }}>
            Selected: {verdict}
          </Text>
        </Section>

        <Section title="Modals — dev launchers">
          <View style={{ gap: 8 }}>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/validation' as never)}
              style={{
                paddingVertical: 12,
                paddingHorizontal: 16,
                borderRadius: 999,
                backgroundColor: '#1A1410',
                alignItems: 'center',
              }}
            >
              <Text style={{ color: '#FFFFFF', fontFamily: 'Geist_500Medium', fontSize: 13 }}>
                Open Validation modal
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/wrapped' as never)}
              style={{
                paddingVertical: 12,
                paddingHorizontal: 16,
                borderRadius: 999,
                backgroundColor: '#FF4D2E',
                alignItems: 'center',
              }}
            >
              <Text style={{ color: '#FFFFFF', fontFamily: 'Geist_500Medium', fontSize: 13 }}>
                Open Wrapped modal
              </Text>
            </Pressable>
          </View>
        </Section>

        <Section title="Nav (floating pill)">
          <Text style={{ fontFamily: 'Geist_400Regular', color: '#7A716A', fontSize: 12 }}>
            Rendered floating at the bottom of the screen ↓
          </Text>
        </Section>
      </Page>

      <Nav active={navSlot} onPress={setNavSlot} />
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#EFEAE2' }}>
      <Text
        style={{
          fontFamily: 'JetBrainsMono_400Regular',
          fontSize: 10,
          letterSpacing: 1.4,
          color: '#7A716A',
          marginBottom: 12,
        }}
      >
        {title.toUpperCase()}
      </Text>
      {children}
    </View>
  );
}
