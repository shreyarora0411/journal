import { Avatar, Box, Button, Text } from '@/components';
import { useAuthStore } from '@/features/auth';
import { appendInviteLink, buildWhatsAppLink } from '@/features/invite';
import { useToast } from '@/hooks/use-toast';
import { getSupabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Recap = {
  year: number;
  tripCount: number;
  cityCount: number;
  topDestination: string | null;
  topDestinationSavedBy: number;
  tasteTwin: {
    display_name: string | null;
    handle: string | null;
    avatar_url: string | null;
    overlap_count: number;
  } | null;
};

const useYearRecap = () => {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  return useQuery({
    queryKey: ['year-recap', userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<Recap> => {
      const year = new Date().getFullYear();
      if (!userId)
        return {
          year,
          tripCount: 0,
          cityCount: 0,
          topDestination: null,
          topDestinationSavedBy: 0,
          tasteTwin: null,
        };
      const supabase = getSupabase();
      const yearStart = `${year}-01-01`;
      const yearEnd = `${year}-12-31`;

      const { data: myTrips } = await supabase
        .from('trips')
        .select('id, cities(name, country_id)')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .gte('start_date', yearStart)
        .lte('start_date', yearEnd);

      type Trow = { id: string; cities: { name: string; country_id: string | null }[] | null };
      const myPlaceNames = new Set<string>();
      const cities = new Set<string>();
      let topName: string | null = null;
      const placeFreq = new Map<string, number>();
      for (const t of (myTrips ?? []) as unknown as Trow[]) {
        for (const p of t.cities ?? []) {
          const key = p.name.toLowerCase();
          myPlaceNames.add(key);
          cities.add(`${key}|${(p.country_id ?? '').toLowerCase()}`);
          const next = (placeFreq.get(key) ?? 0) + 1;
          placeFreq.set(key, next);
          if (!topName || next > (placeFreq.get(topName) ?? 0)) topName = p.name;
        }
      }

      // How many other people in the friend graph have also saved the top place?
      let topSavedBy = 0;
      if (topName) {
        const { data: others } = await supabase
          .from('cities')
          .select('trip:trip_id(user_id)')
          .ilike('name', topName)
          .is('deleted_at', null);
        type O = { trip: { user_id: string } | null };
        const userIds = new Set<string>();
        for (const o of (others ?? []) as unknown as O[]) {
          if (o.trip && o.trip.user_id !== userId) userIds.add(o.trip.user_id);
        }
        topSavedBy = userIds.size;
      }

      // Taste twin: friend with the most overlapping place names.
      const { data: peerPlaces } = await supabase
        .from('cities')
        .select('name, trip:trip_id(user_id, author:user_id(display_name, handle, avatar_url))')
        .is('deleted_at', null);
      type Author = {
        display_name: string | null;
        handle: string | null;
        avatar_url: string | null;
      };
      type P = {
        name: string;
        trip: {
          user_id: string;
          author: Author | null;
        } | null;
      };
      const peerCounts = new Map<string, { count: number; author: Author | null }>();
      for (const p of (peerPlaces ?? []) as unknown as P[]) {
        if (!p.trip || p.trip.user_id === userId) continue;
        if (!myPlaceNames.has(p.name.toLowerCase())) continue;
        const prev = peerCounts.get(p.trip.user_id);
        peerCounts.set(p.trip.user_id, {
          count: (prev?.count ?? 0) + 1,
          author: p.trip.author ?? prev?.author ?? null,
        });
      }
      let twin: Recap['tasteTwin'] = null;
      let twinCount = 0;
      for (const [, v] of peerCounts) {
        if (v.count > twinCount) {
          twinCount = v.count;
          twin = {
            display_name: v.author?.display_name ?? null,
            handle: v.author?.handle ?? null,
            avatar_url: v.author?.avatar_url ?? null,
            overlap_count: v.count,
          };
        }
      }

      return {
        year,
        tripCount: (myTrips ?? []).length,
        cityCount: cities.size,
        topDestination: topName,
        topDestinationSavedBy: topSavedBy,
        tasteTwin: twin,
      };
    },
  });
};

export default function YearInTravelScreen() {
  const recap = useYearRecap();
  const router = useRouter();
  const toast = useToast();

  const onShare = async () => {
    const r = recap.data;
    if (!r) return;
    const text = appendInviteLink(
      `My ${r.year} in travel — ${r.tripCount} trips, ${r.cityCount} cities${r.topDestination ? `, most asked about ${r.topDestination}` : ''}. On Vouch.`,
    );
    try {
      await Linking.openURL(buildWhatsAppLink(text));
    } catch {
      toast.show({ message: 'Could not open share.', variant: 'error' });
    }
  };

  if (recap.isLoading || !recap.data) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FF4D2E' }}>
        <Box flex={1} padding="xl">
          <Text variant="caption" style={{ color: 'rgba(255,255,255,0.8)' }}>
            Loading…
          </Text>
        </Box>
      </SafeAreaView>
    );
  }

  const r = recap.data;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FF4D2E' }}>
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 80 }}>
        <Text style={[styles.eyebrow]}>Your {r.year}</Text>
        <Text style={[styles.display]}>in travel.</Text>

        <View style={[styles.statRow]}>
          <Text style={[styles.statLabel]}>Trips</Text>
          <Text style={[styles.statValue]}>{r.tripCount}</Text>
        </View>
        <View style={[styles.statRow]}>
          <Text style={[styles.statLabel]}>Cities</Text>
          <Text style={[styles.statValue]}>{r.cityCount}</Text>
        </View>

        {r.topDestination ? (
          <Box marginTop="l">
            <Text style={styles.subEyebrow}>Your most-asked-about</Text>
            <Text style={styles.subTitle}>{r.topDestination}</Text>
            {r.topDestinationSavedBy > 0 ? (
              <Text style={styles.subMeta}>{r.topDestinationSavedBy} friends searched it</Text>
            ) : null}
          </Box>
        ) : null}

        {r.tasteTwin ? (
          <Box marginTop="l">
            <Text style={styles.subEyebrow}>Taste twin this year</Text>
            <Box flexDirection="row" alignItems="center" gap="m" marginTop="s">
              <Avatar
                size="md"
                uri={r.tasteTwin.avatar_url}
                fallback={r.tasteTwin.display_name ?? r.tasteTwin.handle ?? '?'}
              />
              <Box flex={1}>
                <Text style={styles.subTitle}>
                  {r.tasteTwin.display_name ?? r.tasteTwin.handle}
                </Text>
                <Text style={styles.subMeta}>{r.tasteTwin.overlap_count} shared places</Text>
              </Box>
            </Box>
          </Box>
        ) : null}

        <Box marginTop="xl" gap="s">
          <Button label="Share your year" variant="ghost" onPress={onShare} fullWidth size="lg" />
          <Button label="Back" variant="ghost" onPress={() => router.back()} />
        </Box>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  eyebrow: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    letterSpacing: 0.8,
    fontFamily: 'Inter_400Regular',
  },
  display: {
    color: '#fff',
    fontSize: 44,
    lineHeight: 48,
    fontFamily: 'Fraunces_500',
    letterSpacing: -0.8,
    marginTop: 4,
    marginBottom: 32,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  statLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 14, fontFamily: 'Inter_400Regular' },
  statValue: { color: '#fff', fontSize: 24, fontFamily: 'Fraunces_500' },
  subEyebrow: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    letterSpacing: 0.6,
    fontFamily: 'Inter_400Regular',
  },
  subTitle: { color: '#fff', fontSize: 24, fontFamily: 'Fraunces_500', marginTop: 4 },
  subMeta: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    marginTop: 2,
  },
});
