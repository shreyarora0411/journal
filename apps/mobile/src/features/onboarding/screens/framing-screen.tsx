import { Box, Button, Text } from '@/components';
import { useAuthStore, useUpdateProfile } from '@/features/auth';
import { useToast } from '@/hooks/use-toast';
import { log } from '@/lib/log';
import { getSupabase } from '@/lib/supabase';
import { DisplayNameSchema } from '@journal/shared';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StepIndicator } from '../components/StepIndicator';

/**
 * Identity (#05 in the design pack). Captures display name + a one-line bio
 * about how the user travels. Photo upload is a placeholder for now — the
 * dashed-circle "Add photo" affordance matches the design but does no work
 * until we wire user-avatar storage (separate from trip-photo storage).
 */
export function FramingScreen() {
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const update = useUpdateProfile();
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  const router = useRouter();
  const toast = useToast();

  useEffect(() => {
    log.event('onboarding.screen_entered', { screen: 'framing' });
  }, []);

  const onContinue = async () => {
    const parsed = DisplayNameSchema.safeParse(name);
    if (!parsed.success) {
      toast.show({
        message: parsed.error.issues[0]?.message ?? 'Tell us what to call you.',
        variant: 'error',
      });
      return;
    }
    try {
      await update.mutateAsync({ display_name: parsed.data });
      // Bio is in users.bio (added in migration 0005). Best-effort — if the
      // column doesn't exist yet (pre-migration), silently skip.
      if (bio.trim().length > 0 && userId) {
        const supabase = getSupabase();
        const { error } = await supabase
          .from('users')
          .update({ bio: bio.trim().slice(0, 140) })
          .eq('id', userId);
        if (error && error.code !== '42703') {
          log.warn('bio update failed', { code: error.code });
        }
      }
      log.event('onboarding.screen_completed', { screen: 'framing' });
      router.replace('/(auth)/instagram');
    } catch (err) {
      log.error('framing update failed', err);
      toast.show({ message: 'Could not save. Try again.', variant: 'error' });
    }
  };

  const onAddPhoto = () => {
    toast.show({ message: 'Photos arrive in v1. Continue for now.', variant: 'info' });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FAF8F3' }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Box flex={1} padding="l">
          <StepIndicator step={2} total={4} />

          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 24 }}
          >
            <Box marginTop="l">
              <Text variant="display" style={{ fontSize: 36, lineHeight: 42 }}>
                {'Who should\nfriends see?'}
              </Text>
              <Text variant="caption" marginTop="m" style={{ fontSize: 14, lineHeight: 22 }}>
                This is how you'll show up when your notes appear in search.
              </Text>
            </Box>

            <Box marginTop="xl" alignItems="center">
              <Pressable
                onPress={onAddPhoto}
                accessibilityRole="button"
                accessibilityLabel="Add photo"
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: 48,
                  borderWidth: 1.4,
                  borderStyle: 'dashed',
                  borderColor: 'rgba(0,0,0,0.25)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#FAF8F3',
                }}
              >
                <Text style={{ fontSize: 24, color: '#9A9A9A' }}>＋</Text>
                <Text variant="meta" marginTop="xs">
                  Add photo
                </Text>
              </Pressable>
            </Box>

            <Box marginTop="xl" gap="l">
              <Box>
                <Text variant="label" marginBottom="s">
                  YOUR NAME
                </Text>
                <View
                  style={{
                    borderWidth: 1,
                    borderColor: 'rgba(0,0,0,0.15)',
                    borderRadius: 12,
                    paddingHorizontal: 12,
                    paddingVertical: 12,
                    backgroundColor: '#FFFFFF',
                  }}
                >
                  <TextInput
                    style={{
                      fontFamily: 'Inter_400Regular',
                      fontSize: 16,
                      color: '#1A1A1A',
                      paddingVertical: 2,
                    }}
                    placeholder="Shrey Arora"
                    placeholderTextColor="#9A9A9A"
                    value={name}
                    onChangeText={setName}
                    autoCapitalize="words"
                    autoFocus
                    maxLength={60}
                  />
                </View>
              </Box>

              <Box>
                <Text variant="label" marginBottom="s">
                  ONE LINE ABOUT HOW YOU TRAVEL
                </Text>
                <View
                  style={{
                    borderWidth: 1,
                    borderColor: 'rgba(0,0,0,0.15)',
                    borderRadius: 12,
                    paddingHorizontal: 12,
                    paddingVertical: 12,
                    backgroundColor: '#FFFFFF',
                  }}
                >
                  <TextInput
                    style={{
                      fontFamily: 'Fraunces_400Italic',
                      fontSize: 14,
                      color: '#1A1A1A',
                      paddingVertical: 2,
                    }}
                    placeholder="Mostly cities, sometimes mountains."
                    placeholderTextColor="#9A9A9A"
                    value={bio}
                    onChangeText={setBio}
                    maxLength={140}
                  />
                </View>
              </Box>
            </Box>
          </ScrollView>

          <Button
            label={update.isPending ? 'Saving…' : 'Continue'}
            onPress={onContinue}
            loading={update.isPending}
            fullWidth
            size="lg"
          />
        </Box>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
