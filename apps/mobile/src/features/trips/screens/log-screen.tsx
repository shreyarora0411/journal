import { Box, Button, Input, Pill, Text, Textarea } from '@/components';
import { useCreateTripQuick } from '@/features/trips';
import { DateField } from '@/features/trips/components/DateField';
import { useToast } from '@/hooks/use-toast';
import { log } from '@/lib/log';
import { zodResolver } from '@hookform/resolvers/zod';
import { type QuickLogForm, QuickLogFormSchema, type Visibility } from '@journal/shared';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Mode = 'quick' | 'detailed';

const visibilityLabel: Record<Visibility, string> = {
  followers: 'Followers',
  friends_of_friends: 'Friends of friends',
  everyone: 'Everyone',
};

export function LogScreen() {
  const [mode, setMode] = useState<Mode>('quick');
  const [showVisibilitySheet, setShowVisibilitySheet] = useState(false);
  const create = useCreateTripQuick();
  const router = useRouter();
  const toast = useToast();

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<QuickLogForm>({
    resolver: zodResolver(QuickLogFormSchema),
    defaultValues: {
      title: '',
      start_date: '',
      end_date: '',
      place_name: '',
      note: '',
      visibility: 'friends_of_friends',
    },
  });

  const visibility = watch('visibility');

  const onSubmit = handleSubmit(async (form) => {
    try {
      const result = await create.mutateAsync({
        ...form,
        // Coerce empty strings to undefined so Zod's optional dates don't fail.
        start_date: form.start_date || undefined,
        end_date: form.end_date || undefined,
        note: form.note || undefined,
      });
      log.event('log.saved', { mode });
      toast.show({ message: 'Trip saved.', variant: 'success' });
      router.replace(`/trip/${result.trip.id}`);
    } catch (err) {
      log.error('save trip failed', err);
      toast.show({ message: 'Could not save the trip. Try again.', variant: 'error' });
    }
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FAF8F3' }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 80 }}>
          <Text variant="title" marginBottom="m">
            Log a trip
          </Text>

          <Box flexDirection="row" gap="s" marginBottom="l">
            <Pill
              label="Quick"
              variant={mode === 'quick' ? 'on' : 'default'}
              onPress={() => setMode('quick')}
            />
            <Pill
              label="Detailed"
              variant={mode === 'detailed' ? 'on' : 'default'}
              onPress={() => setMode('detailed')}
            />
          </Box>

          {mode === 'detailed' ? (
            <Text variant="caption" marginBottom="l">
              Detailed mode adds multiple places, each with its own note. Coming after the pilot —
              for now, log a single trip via Quick.
            </Text>
          ) : null}

          <Box gap="l">
            <Controller
              control={control}
              name="title"
              render={({ field: { onChange, value } }) => (
                <Input
                  label="Title"
                  placeholder="Five days in Pokhara"
                  value={value}
                  onChangeText={onChange}
                  error={errors.title?.message}
                  autoCapitalize="sentences"
                />
              )}
            />

            <Controller
              control={control}
              name="place_name"
              render={({ field: { onChange, value } }) => (
                <Input
                  label="Where"
                  placeholder="Pokhara"
                  value={value}
                  onChangeText={onChange}
                  error={errors.place_name?.message}
                  autoCapitalize="words"
                />
              )}
            />

            <Box flexDirection="row" gap="m">
              <Box flex={1}>
                <Controller
                  control={control}
                  name="start_date"
                  render={({ field: { onChange, value } }) => (
                    <DateField
                      label="Start"
                      placeholder="Pick"
                      value={value ?? ''}
                      onChange={onChange}
                    />
                  )}
                />
              </Box>
              <Box flex={1}>
                <Controller
                  control={control}
                  name="end_date"
                  render={({ field: { onChange, value } }) => (
                    <DateField
                      label="End"
                      placeholder="Pick"
                      value={value ?? ''}
                      onChange={onChange}
                    />
                  )}
                />
              </Box>
            </Box>

            <Controller
              control={control}
              name="note"
              render={({ field: { onChange, value } }) => (
                <Textarea
                  label="Note"
                  placeholder="Woke up to the lake every morning. Slow mornings, long walks, paragliding once. The Pavilions in Lakeside is where you want to stay…"
                  value={value ?? ''}
                  onChangeText={onChange}
                  error={errors.note?.message}
                  minRows={6}
                  maxRows={20}
                />
              )}
            />

            <Box
              flexDirection="row"
              alignItems="center"
              justifyContent="space-between"
              paddingVertical="s"
            >
              <Text variant="caption">Privacy</Text>
              <Pill
                label={visibilityLabel[visibility]}
                variant="accent"
                onPress={() => setShowVisibilitySheet((v) => !v)}
              />
            </Box>

            {showVisibilitySheet ? (
              <Box gap="s" backgroundColor="surface" borderRadius="m" padding="m">
                {(['followers', 'friends_of_friends', 'everyone'] as Visibility[]).map((v) => (
                  <Pill
                    key={v}
                    label={visibilityLabel[v]}
                    variant={visibility === v ? 'on' : 'default'}
                    onPress={() => {
                      setValue('visibility', v);
                      setShowVisibilitySheet(false);
                    }}
                  />
                ))}
              </Box>
            ) : null}

            <Button
              label={isSubmitting || create.isPending ? 'Saving…' : 'Save trip'}
              onPress={onSubmit}
              loading={isSubmitting || create.isPending}
              fullWidth
              size="lg"
            />
          </Box>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
