import { log } from '@/lib/log';
import { getSupabase } from '@/lib/supabase';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listKeys } from './keys';

export type ListItemRow = {
  id: string;
  list_id: string;
  destination_id: string | null;
  city_id: string | null;
  note: string | null;
  order_index: number;
  created_at: string;
  // Joined display fields:
  destination_name?: string | null;
  destination_country?: string | null;
  city_name?: string | null;
};

export const useListItems = (listId: string | null | undefined) =>
  useQuery({
    queryKey: listId ? listKeys.items(listId) : listKeys.items('null'),
    enabled: Boolean(listId),
    queryFn: async (): Promise<ListItemRow[]> => {
      if (!listId) return [];
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('list_items')
        .select(
          'id, list_id, destination_id, city_id, note, order_index, created_at, destination:destination_id(name, country), city:city_id(name)',
        )
        .eq('list_id', listId)
        .order('order_index', { ascending: true });
      if (error) throw error;
      type Raw = ListItemRow & {
        destination: { name: string; country: string | null } | null;
        city: { name: string } | null;
      };
      return ((data ?? []) as unknown as Raw[]).map((r) => ({
        ...r,
        destination_name: r.destination?.name ?? null,
        destination_country: r.destination?.country ?? null,
        city_name: r.city?.name ?? null,
      }));
    },
  });

type AddVars = {
  listId: string;
  destination_id?: string | null;
  city_id?: string | null;
  note?: string | null;
};

export const useAddListItem = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: AddVars) => {
      if (!vars.destination_id && !vars.city_id) throw new Error('Need a destination or city');
      const supabase = getSupabase();
      const { count } = await supabase
        .from('list_items')
        .select('id', { count: 'exact', head: true })
        .eq('list_id', vars.listId);
      const order_index = count ?? 0;
      const { error } = await supabase.from('list_items').insert({
        list_id: vars.listId,
        destination_id: vars.destination_id ?? null,
        city_id: vars.city_id ?? null,
        note: vars.note ?? null,
        order_index,
      });
      if (error) throw error;
      log.event('list.item_added');
      return { listId: vars.listId };
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: listKeys.items(result.listId) });
    },
  });
};
