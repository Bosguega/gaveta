type PurchasedItem = {
  purchasedAt?: string | null;
};

export function groupByMonth<T extends PurchasedItem>(items: T[]) {
  return items.reduce((acc, item) => {
    if (!item.purchasedAt) return acc;

    const key = item.purchasedAt.slice(0, 7); // YYYY-MM
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);

    return acc;
  }, {} as Record<string, T[]>);
}

export function buildTimeSeries<T>(
  grouped: Record<string, T[]>,
  valueFn: (item: T) => number,
) {
  return Object.entries(grouped)
    .map(([date, items]) => ({
      date,
      value: items.reduce((acc, i) => acc + valueFn(i), 0),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
