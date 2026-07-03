import { FloatingTabBar } from '@/components';
import { Tabs } from 'expo-router';

/**
 * Five-tab IA per the lore brief §6:
 *   Book / Search / Add / Friends / You
 *
 * The Add tab in the middle is rendered as a raised coral disc by
 * FloatingTabBar — the rest of the pill stays flat. Detail routes
 * (trip / place / list / friend / map / year-in-travel / etc.) live
 * inside (tabs) so the pill persists on them; each is hidden from the
 * bar via `href: null`.
 */
export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <FloatingTabBar {...props} />}>
      <Tabs.Screen name="book" options={{ title: 'Map' }} />
      <Tabs.Screen name="search" options={{ title: 'Go out' }} />
      <Tabs.Screen name="add" options={{ title: 'Log' }} />
      <Tabs.Screen name="friends" options={{ title: 'People' }} />
      <Tabs.Screen name="you" options={{ title: 'You' }} />

      {/* Hidden routes — kept inside (tabs) so the bar persists. */}
      <Tabs.Screen name="trip/[id]/index" options={{ href: null }} />
      <Tabs.Screen name="trip/[id]/confirm" options={{ href: null }} />
      <Tabs.Screen name="trip/[id]/edit" options={{ href: null }} />
      <Tabs.Screen name="place/[id]" options={{ href: null }} />
      <Tabs.Screen name="destination/[slug]" options={{ href: null }} />
      <Tabs.Screen name="list/[id]" options={{ href: null }} />
      <Tabs.Screen name="list/new" options={{ href: null }} />
      <Tabs.Screen name="friend/[handle]" options={{ href: null }} />
      <Tabs.Screen name="map" options={{ href: null }} />
      <Tabs.Screen name="year-in-travel" options={{ href: null }} />
      <Tabs.Screen name="house-rules" options={{ href: null }} />
      <Tabs.Screen name="wishlist" options={{ href: null }} />
      <Tabs.Screen name="trip-notebook/[id]" options={{ href: null }} />
      <Tabs.Screen name="ask/index" options={{ href: null }} />
      <Tabs.Screen name="ask/[id]" options={{ href: null }} />
      <Tabs.Screen name="spot/[id]" options={{ href: null }} />
      <Tabs.Screen name="person/[id]" options={{ href: null }} />
      <Tabs.Screen name="taste-setup" options={{ href: null }} />
    </Tabs>
  );
}
