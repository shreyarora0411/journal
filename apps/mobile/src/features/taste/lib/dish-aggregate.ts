/**
 * Folds per-lover "what to order" picks into one line for the spot page.
 *
 * Dedup key is trim().toLowerCase() but the FIRST-SEEN casing wins — the
 * line quotes people, so "Raan" stays "Raan" even when a later mention
 * types it differently. Ordered by mention count (consensus first), ties
 * broken by first-seen, capped at 6 so "THE ORDER" stays a line, not a menu.
 */
export const aggregateDishes = (
  lovers: { dishes: string[] | null }[],
  mine?: string[] | null,
): string[] => {
  const byKey = new Map<string, { dish: string; count: number; order: number }>();
  const add = (raw: string) => {
    const dish = raw.trim();
    if (!dish) return;
    const key = dish.toLowerCase();
    const entry = byKey.get(key);
    if (entry) entry.count += 1;
    else byKey.set(key, { dish, count: 1, order: byKey.size });
  };
  for (const lover of lovers) {
    for (const dish of lover.dishes ?? []) add(dish);
  }
  for (const dish of mine ?? []) add(dish);
  return [...byKey.values()]
    .sort((a, b) => b.count - a.count || a.order - b.order)
    .slice(0, 6)
    .map((entry) => entry.dish);
};
