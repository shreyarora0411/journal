import PostHog from 'posthog-react-native';

const apiKey = process.env.EXPO_PUBLIC_POSTHOG_KEY;
const host = process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com';

let client: PostHog | null = null;

export const initPostHog = async (): Promise<PostHog | null> => {
  if (!apiKey || client) return client;
  client = new PostHog(apiKey, {
    host,
    enableSessionReplay: false,
    flushAt: 20,
    flushInterval: 30_000,
    customAppProperties: (defaults) => ({
      ...defaults,
      // Strip device-level identifiers we don't need.
      $device_id: undefined,
    }),
  });
  return client;
};

export const getPostHog = () => client;
