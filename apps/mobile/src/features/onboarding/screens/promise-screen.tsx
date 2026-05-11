import { Box, Button, Text } from '@/components';
import { log } from '@/lib/log';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { OpenBookMark } from '../components/OpenBookMark';

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
        <View style={{ alignItems: 'center', marginBottom: 32 }}>
          <OpenBookMark />
        </View>

        <Text variant="display" textAlign="center">
          {'A travel book that\nsearches for you.'}
        </Text>
        <Text variant="caption" textAlign="center" marginTop="m">
          Private to you. Searchable only by the friends you choose.
        </Text>

        <Box marginTop="xl">
          <Button
            label="Start my book"
            onPress={() => router.push('/(auth)/phone' as never)}
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
