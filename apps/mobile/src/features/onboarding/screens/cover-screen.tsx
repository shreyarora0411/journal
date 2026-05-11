import { Box, Text } from '@/components';
import { log } from '@/lib/log';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/**
 * Cover (#01 of the onboarding pack). The brand-defining moment.
 * Terracotta bleed, white serif headline, white CTA with brand-color text.
 */
export default function CoverScreen() {
  const router = useRouter();

  useEffect(() => {
    log.event('onboarding.screen_entered', { screen: 'cover' });
  }, []);

  const onBegin = () => {
    log.event('onboarding.screen_completed', { screen: 'cover', choice: 'begin' });
    router.push('/(auth)/problem' as never);
  };

  // Anonymous-auth flow has no separate sign-in surface — alias to Begin.
  // Stays distinct in analytics so we can size returning-user intent later.
  const onSignIn = () => {
    log.event('onboarding.screen_completed', { screen: 'cover', choice: 'returning' });
    router.push('/(auth)/problem' as never);
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: '#993C1D' }}>
      <StatusBar style="light" />

      {/* Wordmark */}
      <View style={{ paddingTop: 16, paddingHorizontal: 24 }}>
        <Text
          style={{
            fontFamily: 'Fraunces_500',
            fontSize: 18,
            color: '#FFFFFF',
            letterSpacing: 0.2,
          }}
        >
          Postmark
        </Text>
      </View>

      {/* Headline */}
      <Box flex={1} justifyContent="center" paddingHorizontal="xl">
        <Text
          style={{
            fontFamily: 'Fraunces_500',
            fontSize: 44,
            lineHeight: 50,
            color: '#FFFFFF',
            letterSpacing: -0.8,
          }}
        >
          {'Where to go,\nfrom the people\nwho know you.'}
        </Text>
        <Text
          style={{
            fontFamily: 'Inter_400Regular',
            fontSize: 14,
            lineHeight: 22,
            color: 'rgba(255,255,255,0.8)',
            marginTop: 20,
          }}
        >
          A private travel book, searchable by the friends you'd ask anyway.
        </Text>
      </Box>

      {/* CTA */}
      <View style={{ paddingHorizontal: 24, paddingBottom: 32 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Begin"
          onPress={onBegin}
          style={({ pressed }) => ({
            backgroundColor: '#FFFFFF',
            borderRadius: 12,
            paddingVertical: 16,
            alignItems: 'center',
            opacity: pressed ? 0.9 : 1,
          })}
        >
          <Text
            style={{
              fontFamily: 'Inter_500Medium',
              fontSize: 16,
              color: '#993C1D',
            }}
          >
            Begin
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="I already have a book"
          onPress={onSignIn}
          style={{ paddingVertical: 14, alignItems: 'center' }}
        >
          <Text
            style={{
              fontFamily: 'Inter_400Regular',
              fontSize: 12,
              color: 'rgba(255,255,255,0.85)',
            }}
          >
            I already have a book
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
