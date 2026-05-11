import { theme } from '@/theme';
import { Tabs } from 'expo-router';
import { Text } from 'react-native';

/**
 * Five-tab IA per the Postmark brief §6 (Information architecture):
 *   Book / Search / Add / Friends / You
 *
 * `Add` is meant to be a bottom-sheet trigger; in v0 it routes to the same
 * Quick log form via a normal tab nav. Convert to a modal presentation when
 * we polish the Add flow (CLAUDE.md §8).
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
    </Tabs>
  );
}
