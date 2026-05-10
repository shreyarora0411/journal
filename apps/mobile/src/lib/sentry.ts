import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

const PII_KEYS = new Set([
  'phone',
  'phoneNumber',
  'phone_number',
  'email',
  'password',
  'token',
  'access_token',
  'refresh_token',
  'authorization',
]);

const scrub = (input: unknown, depth = 0): unknown => {
  if (depth > 6 || input == null) return input;
  if (Array.isArray(input)) return input.map((v) => scrub(v, depth + 1));
  if (typeof input === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      out[k] = PII_KEYS.has(k) ? '[scrubbed]' : scrub(v, depth + 1);
    }
    return out;
  }
  return input;
};

export const initSentry = () => {
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: __DEV__ ? 'development' : 'production',
    release: Constants.expoConfig?.version,
    enableAutoSessionTracking: true,
    sendDefaultPii: false,
    beforeSend: (event) => {
      if (event.user) {
        // Keep only the hashed user id, drop everything else.
        event.user = event.user.id ? { id: event.user.id } : undefined;
      }
      if (event.contexts) event.contexts = scrub(event.contexts) as typeof event.contexts;
      if (event.extra) event.extra = scrub(event.extra) as typeof event.extra;
      return event;
    },
  });
};

export { Sentry };
