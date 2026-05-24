import { Box, Button, Text } from '@/components';
import { useAuthStore, useProfile, useUpdateProfile, useUploadAvatar } from '@/features/auth';
import { useToast } from '@/hooks/use-toast';
import { log } from '@/lib/log';
import { getSupabase } from '@/lib/supabase';
import { DisplayNameSchema } from '@journal/shared';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
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
 * Identity (#05 in the design pack). Captures display name + a one-line bio
 * about how the user travels. Photo upload is a placeholder for now — the
 * dashed-circle "Add photo" affordance matches the design but does no work
 * until we wire user-avatar storage (separate from trip-photo storage).
 */
export function FramingScreen() {
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [homeCity, setHomeCity] = useState('');
  const update = useUpdateProfile();
  const uploadAvatar = useUploadAvatar();
  const profile = useProfile();
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  const router = useRouter();
  const toast = useToast();
  const avatarUri = profile.data?.avatar_url ?? null;

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
      toast.show({ message: 'Tell us where you live.', variant: 'error' });
      return;
    }
    try {
      // Forward-geocode the home city to lat/lng + country code so the
      // camera-roll import can classify clusters by distance-from-home
      // (ADR 0009). Geocoder failure is non-blocking — we still save the
      // typed city string.
      let home_lat: number | undefined;
      let home_lng: number | undefined;
      let home_country_code: string | undefined;
      try {
        const geo = await Location.geocodeAsync(trimmedHome);
        const hit = geo[0];
        if (hit) {
          home_lat = hit.latitude;
          home_lng = hit.longitude;
          const reverse = await Location.reverseGeocodeAsync({
            latitude: hit.latitude,
            longitude: hit.longitude,
          });
          const code = reverse[0]?.isoCountryCode;
          if (code && /^[A-Z]{2}$/.test(code)) home_country_code = code;
        }
      } catch (err) {
        log.warn('home city geocode failed', { error: String(err) });
      }

      await update.mutateAsync({
        display_name: parsed.data,
        home_city: trimmedHome,
        home_lat,
        home_lng,
        home_country_code,
      });
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
      router.replace('/(auth)/circle');
    } catch (err) {
      // Surface the real reason in the toast so we can debug on-device
      // instead of seeing "[object Object]". Supabase errors carry a
      // human-readable `.message`; everything else falls back to String().
      const reason =
        err && typeof err === 'object' && 'message' in err && typeof err.message === 'string'
          ? err.message
          : String(err);
      log.error('framing update failed', { error: reason });
      toast.show({ message: `Could not save: ${reason}`, variant: 'error' });
    }
  };

  const onAddPhoto = async () => {
    if (Platform.OS !== 'web') {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        toast.show({ message: 'No photo permission.', variant: 'error' });
        return;
      }
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
      allowsEditing: true,
      aspect: [1, 1],
      exif: false,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset) return;
    try {
      await uploadAvatar.mutateAsync(asset.uri);
      toast.show({ message: 'Photo set.', variant: 'success' });
    } catch (err) {
      log.error('avatar upload failed', err);
      toast.show({ message: 'Upload failed. Try again.', variant: 'error' });
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Box flex={1} padding="l">
          <OnboardingStepHeader step={2} total={4} showBack />

          <ScrollView
            keyboardShouldPersistTaps="handled"
            // Enough bottom padding that the last field's eyebrow + helper
            // text stay visible above an open keyboard on tall phones.
            contentContainerStyle={{ paddingBottom: 220 }}
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
                  borderWidth: avatarUri ? 0 : 1.4,
                  borderStyle: 'dashed',
                  borderColor: 'rgba(0,0,0,0.25)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#FFFFFF',
                  overflow: 'hidden',
                }}
              >
                {avatarUri ? (
                  <Image
                    source={{ uri: avatarUri }}
                    style={{ width: 96, height: 96, borderRadius: 48 }}
                    contentFit="cover"
                  />
                ) : (
                  <>
                    <Text style={{ fontSize: 24, color: '#9A9A9A' }}>
                      {uploadAvatar.isPending ? '…' : '＋'}
                    </Text>
                    <Text variant="meta" marginTop="xs">
                      Add photo
                    </Text>
                  </>
                )}
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
                    borderColor: '#1A1410',
                    borderRadius: 14,
                    paddingHorizontal: 12,
                    paddingVertical: 12,
                    backgroundColor: '#FFFFFF',
                  }}
                >
                  <TextInput
                    // selectionColor pins the iOS cursor + selection highlight
                    // to coral. textContentType="name" + autoComplete suppress
                    // the system's gold autofill chip on the field itself.
                    selectionColor="#FF4D2E"
                    textContentType="name"
                    autoComplete="name"
                    style={{
                      fontFamily: 'Geist_400Regular',
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

              <Box>
                <Text variant="label" marginBottom="s">
                  ONE LINE ABOUT HOW YOU TRAVEL
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
                    textContentType="none"
                    autoComplete="off"
                    style={{
                      fontFamily: 'InstrumentSerif_400Italic',
                      fontSize: 16,
                      color: '#1A1410',
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

              <Box>
                <Text variant="label" marginBottom="s">
                  WHERE DO YOU LIVE?
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
                    textContentType="addressCity"
                    autoComplete="off"
                    style={{
                      fontFamily: 'Geist_400Regular',
                      fontSize: 16,
                      color: '#1A1410',
                      paddingVertical: 2,
                    }}
                    placeholder="Mumbai, Bangalore, Delhi…"
                    placeholderTextColor="#9A9A9A"
                    value={homeCity}
                    onChangeText={setHomeCity}
                    autoCapitalize="words"
                    maxLength={80}
                  />
                </View>
                <Text variant="meta" marginTop="xs">
                  We use this to recognise which of your photos are trips. Stays private.
                </Text>
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
