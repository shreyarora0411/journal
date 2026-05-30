import { Box, Button, PlacePicker, Text } from '@/components';
import { useUpdateProfile } from '@/features/auth';
import { useToast } from '@/hooks/use-toast';
import type { PlaceDetails } from '@/lib/google-places';
import { log } from '@/lib/log';
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
import { OnboardingStepHeader } from '../components/OnboardingStepHeader';

/**
 * Pilot onboarding step 1 of 2 — name + home city.
 *
 * Two fields: the display name your friends will see, and the city you
 * live in (so we can tell weekend-trips from real trips later, and so
 * Tokyo doesn't get confused with "Tokyo, my home"). Bio + avatar are
 * deferred to a post-onboarding edit-profile surface.
 */
export function FramingScreen() {
  const [name, setName] = useState('');
  const [homeCity, setHomeCity] = useState('');
  const [homeCityPicked, setHomeCityPicked] = useState<PlaceDetails | null>(null);
  const [homePickerOpen, setHomePickerOpen] = useState(false);

  const update = useUpdateProfile();
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
    const trimmedHome = homeCity.trim();
    if (trimmedHome.length === 0) {
      toast.show({ message: 'Where do you live?', variant: 'error' });
      return;
    }
    try {
      await update.mutateAsync({
        display_name: parsed.data,
        home_city: trimmedHome,
        // Picked-from-autocomplete gives us lat/lng + ISO country
        // (for foreign-trip detection later). Free-text leaves them
        // undefined; we still save the city name.
        home_lat: homeCityPicked?.lat ?? undefined,
        home_lng: homeCityPicked?.lng ?? undefined,
        home_country_code: undefined,
      });
      log.event('onboarding.screen_completed', { screen: 'framing' });
      router.replace('/(auth)/circle');
    } catch (err) {
      const reason =
        err && typeof err === 'object' && 'message' in err && typeof err.message === 'string'
          ? err.message
          : String(err);
      log.error('framing update failed', { error: reason });
      toast.show({ message: `Could not save: ${reason}`, variant: 'error' });
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Box flex={1} padding="l">
          <OnboardingStepHeader step={1} total={2} showBack />

          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 200 }}
          >
            <Box marginTop="l">
              <Text variant="display" style={{ fontSize: 36, lineHeight: 42 }}>
                {'A little\nabout you.'}
              </Text>
              <Text variant="caption" marginTop="m" style={{ fontSize: 14, lineHeight: 22 }}>
                Your name shows up next to your notes. Your home city stays private — we use it to
                tell weekend hangs from real trips.
              </Text>
            </Box>

            <Box marginTop="xl">
              <Text variant="label" marginBottom="s">
                YOUR NAME
              </Text>
              <View
                style={{
                  borderWidth: 1,
                  borderColor: '#1A1410',
                  borderRadius: 14,
                  paddingHorizontal: 12,
                  paddingVertical: 12,
                  backgroundColor: '#FFFFFF',
                }}
              >
                <TextInput
                  selectionColor="#FF4D2E"
                  textContentType="name"
                  autoComplete="name"
                  style={{
                    fontFamily: 'DMSans_400Regular',
                    fontSize: 16,
                    color: '#1A1410',
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

            <Box marginTop="xl">
              <Text variant="label" marginBottom="s">
                WHERE DO YOU LIVE?
              </Text>
              {homePickerOpen || homeCity.length === 0 ? (
                <PlacePicker
                  mode="city"
                  placeholder="Mumbai, Bangalore, Delhi…"
                  initialQuery={homeCity}
                  onPick={(details) => {
                    setHomeCity(details.name);
                    setHomeCityPicked(details);
                    setHomePickerOpen(false);
                  }}
                  onFreeText={(typed) => {
                    setHomeCity(typed);
                    setHomeCityPicked(null);
                    setHomePickerOpen(false);
                  }}
                />
              ) : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Change home city"
                  onPress={() => setHomePickerOpen(true)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    borderWidth: 1,
                    borderColor: '#EFEAE2',
                    borderRadius: 14,
                    paddingHorizontal: 14,
                    paddingVertical: 14,
                    backgroundColor: '#FFFFFF',
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text variant="body" style={{ color: '#1A1410' }}>
                      {homeCity}
                    </Text>
                    {homeCityPicked?.country ? (
                      <Text variant="meta" marginTop="xs">
                        {homeCityPicked.country}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={{ color: '#FF4D2E', fontFamily: 'DMSans_600SemiBold' }}>Change</Text>
                </Pressable>
              )}
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
