import { getPostHog } from './posthog';
import { Sentry } from './sentry';

type Level = 'debug' | 'info' | 'warn' | 'error';

type JsonValue = string | number | boolean | null | { [k: string]: JsonValue } | JsonValue[];
type EventProps = Record<string, JsonValue>;

const consoleFor = (level: Level) => {
  if (level === 'error') return console.error;
  if (level === 'warn') return console.warn;
  return console.log;
};

/**
 * Render any thrown value as a readable string. Supabase/PostgREST errors are
 * PLAIN OBJECTS ({ message, code, details, hint }), not Error instances — so
 * the old `String(error)` collapsed them to "[object Object]", hiding the one
 * thing we need (the error code) when a mutation fails. Surface message + code
 * + details so a failed insert tells us *why* (e.g. 42P01 = table missing,
 * 23503 = FK violation, 42501 = RLS denied).
 */
const describeError = (error: unknown): string => {
  if (error == null) return '';
  if (error instanceof Error) return error.message;
  if (typeof error === 'object') {
    const e = error as { message?: unknown; code?: unknown; details?: unknown; hint?: unknown };
    const parts = [
      typeof e.message === 'string' ? e.message : null,
      e.code != null ? `code=${String(e.code)}` : null,
      typeof e.details === 'string' ? e.details : null,
      typeof e.hint === 'string' ? e.hint : null,
    ].filter((p): p is string => Boolean(p));
    if (parts.length > 0) return parts.join(' · ');
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
  return String(error);
};

const emit = (level: Level, message: string, props?: EventProps) => {
  if (__DEV__) {
    consoleFor(level)(`[${level}] ${message}`, props ?? '');
  }
  Sentry.addBreadcrumb({
    level: level === 'debug' ? 'debug' : level === 'warn' ? 'warning' : level,
    message,
    data: props,
  });
};

export const log = {
  debug: (message: string, props?: EventProps) => emit('debug', message, props),
  info: (message: string, props?: EventProps) => emit('info', message, props),
  warn: (message: string, props?: EventProps) => emit('warn', message, props),
  error: (message: string, error?: unknown, props?: EventProps) => {
    const errorMsg = describeError(error);
    emit('error', message, { ...props, error: errorMsg });
    if (error instanceof Error) {
      Sentry.captureException(error, { extra: props });
    } else {
      Sentry.captureMessage(message, { level: 'error', extra: { ...props, error: errorMsg } });
    }
  },
  /** Product analytics event. Routes to PostHog. */
  event: (name: string, props?: EventProps) => {
    if (__DEV__) console.info(`[event] ${name}`, props ?? '');
    getPostHog()?.capture(name, props);
  },
  /** Set the analytics user. Pass null on logout. */
  identify: (userId: string | null, props?: EventProps) => {
    const ph = getPostHog();
    if (!ph) return;
    if (userId) {
      ph.identify(userId, props);
      Sentry.setUser({ id: userId });
    } else {
      ph.reset();
      Sentry.setUser(null);
    }
  },
};
