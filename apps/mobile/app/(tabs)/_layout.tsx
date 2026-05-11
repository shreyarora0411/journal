import { theme } from '@/theme';
import { Tabs } from 'expo-router';
import { Text } from 'react-native';

/**
 * Five-tab IA per the Postmark brief §6 (Information architecture):
 *   Book / Search / Add / Friends / You
 *
 * Detail routes (trip, place, list, friend, map, year-in-travel) live inside
 * (tabs) so the bottom tab bar persists on them. Each is hidden from the tab
 * bar with `href: null`.
 */
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.ink,
        tabBarInactiveTintColor: theme.colors.inkTertiary,
        tabBarStyle: {
          backgroundColor: theme.colors.paper,
          borderTopColor: theme.colors.divider,
        },
        tabBarLabelStyle: { fontFamily: 'Inter_400Regular', fontSize: 11 },
      }}
    >
      <Tabs.Screen
        name="book"
        options={{
          title: 'Book',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 16 }}>□</Text>,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 16 }}>○</Text>,
        }}
      />
      <Tabs.Screen
        name="add"
        options={{
          title: 'Add',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 16 }}>＋</Text>,
        }}
      />
      <Tabs.Screen
        name="friends"
        options={{
          title: 'Friends',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 16 }}>◇</Text>,
        }}
      />
      <Tabs.Screen
        name="you"
        options={{
          title: 'You',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 16 }}>●</Text>,
        }}
      />

      {/* Hidden routes — kept inside (tabs) so the bar persists. */}
      <Tabs.Screen name="trip/[id]/index" options={{ href: null }} />
      <Tabs.Screen name="trip/[id]/confirm" options={{ href: null }} />
      <Tabs.Screen name="place/[name]" options={{ href: null }} />
      <Tabs.Screen name="list/[id]" options={{ href: null }} />
      <Tabs.Screen name="list/new" options={{ href: null }} />
      <Tabs.Screen name="friend/[handle]" options={{ href: null }} />
      <Tabs.Screen name="map" options={{ href: null }} />
      <Tabs.Screen name="year-in-travel" options={{ href: null }} />
    </Tabs>
  );
}
