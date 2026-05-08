import { useMemo } from "react";
import { parseBRL } from "../../utils/currency";
import { parseToDate } from "../../utils/date";
import { filterBySearch, filterItemsByPeriod, sortItems } from "../../utils/filters";
import type { PurchasedItem, SearchSortBy, SortDirection, SearchFilters } from "../../types/ui";

interface UseFilteredSearchItemsReturn {
  items: PurchasedItem[];
  totalCount: number;
}

interface UseFilteredSearchItemsParams {
  items: (PurchasedItem & { canonical_name?: string })[];
  searchQuery: string;
  sortOrder: SearchSortBy;
  sortDirection: SortDirection;
  searchFilters: SearchFilters;
}

export function useFilteredSearchItems({
  items,
  searchQuery,
  sortOrder,
  sortDirection,
  searchFilters,
}: UseFilteredSearchItemsParams): UseFilteredSearchItemsReturn {
  return useMemo(() => {
    let baseItems = filterItemsByPeriod(
      items,
      searchFilters.period,
      searchFilters.startDate,
      searchFilters.endDate,
    );

    baseItems =
      searchQuery.trim() === ""
        ? baseItems
        : filterBySearch(baseItems, searchQuery, [
            "name",
            "normalized_name",
            "category",
            "canonical_name",
          ]);

    const customSorters: Record<string, (a: PurchasedItem, b: PurchasedItem) => number> = {
      price: (a, b) => parseBRL(a.price) - parseBRL(b.price),
      recent: (a, b) => {
        const dateA = parseToDate(a.purchasedAt || "");
        const dateB = parseToDate(b.purchasedAt || "");
        const timeA = dateA ? dateA.getTime() : 0;
        const timeB = dateB ? dateB.getTime() : 0;
        return timeA - timeB;
      },
    };

    const sorted = sortItems(baseItems, sortOrder, sortDirection, customSorters);

    return {
      items: sorted,
      totalCount: sorted.length,
    };
  }, [items, searchQuery, sortOrder, sortDirection, searchFilters]);
}
