import { Box, Text } from '@/components';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, TextInput, View } from 'react-native';

type Props = {
  label: string;
  /** ISO YYYY-MM-DD or empty string. */
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
};

const toISO = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const fromISO = (iso: string): Date => {
  if (!iso) return new Date();
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return new Date();
  return new Date(y, m - 1, d);
};

/**
 * Cross-platform date field. On native shows the OS picker; on web falls back
 * to the HTML <input type="date"> via a TextInput passthrough. Both emit ISO
 * YYYY-MM-DD strings so the form layer doesn't care which it got.
 */
export function DateField({ label, value, onChange, placeholder }: Props) {
  const [open, setOpen] = useState(false);

  if (Platform.OS === 'web') {
    return (
      <Box>
        <Text variant="label" marginBottom="s">
          {label.toUpperCase()}
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
            // Web text inputs accept date types via the inputMode hack — on the
            // web React Native renderer, the type='date' prop falls through.
            // @ts-expect-error — web-only DOM prop on RN TextInput.
            type="date"
            value={value}
            onChangeText={onChange}
            placeholder={placeholder ?? 'YYYY-MM-DD'}
            placeholderTextColor="#9A9A9A"
            style={{
              fontFamily: 'Inter_400Regular',
              fontSize: 16,
              color: '#1A1A1A',
              paddingVertical: 2,
            }}
          />
        </View>
      </Box>
    );
  }

  return (
    <Box>
      <Text variant="label" marginBottom="s">
        {label.toUpperCase()}
      </Text>
      <Pressable
        onPress={() => setOpen(true)}
        style={{
          borderWidth: 1,
          borderColor: 'rgba(0,0,0,0.15)',
          borderRadius: 12,
          paddingHorizontal: 12,
          paddingVertical: 14,
          backgroundColor: '#FFFFFF',
        }}
      >
        <Text
          style={{
            fontFamily: 'Inter_400Regular',
            fontSize: 16,
            color: value ? '#1A1A1A' : '#9A9A9A',
          }}
        >
          {value || placeholder || 'Pick a date'}
        </Text>
      </Pressable>

      {open ? (
        <DateTimePicker
          value={fromISO(value)}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={(event, selected) => {
            // iOS keeps the picker mounted (inline); Android dismisses itself.
            if (Platform.OS !== 'ios') setOpen(false);
            if (event.type === 'dismissed') return;
            if (selected) onChange(toISO(selected));
          }}
        />
      ) : null}

      {open && Platform.OS === 'ios' ? (
        <Pressable onPress={() => setOpen(false)} style={{ paddingVertical: 8 }}>
          <Text variant="body" textAlign="right">
            Done
          </Text>
        </Pressable>
      ) : null}
    </Box>
  );
}
