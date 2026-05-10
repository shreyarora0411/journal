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
    const errorMsg = error instanceof Error ? error.message : String(error ?? '');
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
