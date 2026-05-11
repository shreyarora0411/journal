import { Box, Button, Text } from '@/components';
import { log } from '@/lib/log';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function PromiseScreen() {
  const router = useRouter();

  useEffect(() => {
    log.event('onboarding.screen_entered', { screen: 'promise' });
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FAF8F3' }}>
      <ScrollView
        contentContainerStyle={{
          padding: 24,
          flexGrow: 1,
          justifyContent: 'center',
          paddingBottom: 24,
        }}
      >
        <View style={{ alignItems: 'center', marginBottom: 24 }}>
          <View
            style={{
              width: 120,
              height: 120,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: 'rgba(0,0,0,0.25)',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#FAF8F3',
              position: 'relative',
            }}
          >
            <Text
              style={{
                fontFamily: 'Fraunces_400Italic',
                fontSize: 56,
                color: '#1A1A1A',
                lineHeight: 64,
              }}
            >
              p
            </Text>
            <View
              style={{
                position: 'absolute',
                top: -4,
                right: 16,
                width: 14,
                height: 22,
                backgroundColor: '#993C1D',
                borderRadius: 1,
              }}
            />
          </View>
        </View>

        <Text variant="display" textAlign="center">
          A travel book that{'\n'}searches for you.
        </Text>
        <Text variant="caption" textAlign="center" marginTop="m">
          Private to you. Searchable only by the friends you choose.
        </Text>

        <Box marginTop="xl">
          <Button
            label="Start my book"
            onPress={() => router.replace('/(auth)/framing' as never)}
            fullWidth
            size="lg"
          />
          <Text variant="caption" textAlign="center" marginTop="s">
            Takes about a minute
          </Text>
        </Box>
      </ScrollView>
    </SafeAreaView>
  );
}
