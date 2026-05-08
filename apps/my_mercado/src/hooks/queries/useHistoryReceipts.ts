import { useCallback, useEffect, useMemo, useState } from "react";
import { useAllReceiptsQuery } from "./useReceiptsQuery";
import { useUiStore } from "../../stores/useUiStore";
import { applyReceiptFilters } from "../../utils/filters";
import type { Receipt } from "../../types/domain";
import type { HistoryFilters } from "../../types/ui";

interface UseHistoryReceiptsReturn {
  receipts: Receipt[];
  items: Receipt[];
  allItems: Receipt[];
  totalCount: number;
  hasMore: boolean;
  loadMore: () => void;
  isLoading: boolean;
  filters: HistoryFilters;
  setFilters: (
    filters: HistoryFilters | ((prev: HistoryFilters) => HistoryFilters),
  ) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  refetch: () => void;
}

const PAGE_SIZE = 50;

export function useHistoryReceipts(): UseHistoryReceiptsReturn {
  const { data: savedReceipts = [], isLoading, refetch } = useAllReceiptsQuery();

  const filters = useUiStore((state) => state.historyFilters);
  const setFilters = useUiStore((state) => state.setHistoryFilters);
  const searchQuery = useUiStore((state) => state.historyFilter);
  const setSearchQuery = useUiStore((state) => state.setHistoryFilter);

  const [page, setPage] = useState(1);

  const filteredReceipts = useMemo(
    () => applyReceiptFilters(savedReceipts, searchQuery, filters),
    [savedReceipts, searchQuery, filters],
  );

  useEffect(() => {
    setPage(1);
  }, [searchQuery, filters, savedReceipts.length]);

  const items = useMemo(
    () => filteredReceipts.items.slice(0, page * PAGE_SIZE),
    [filteredReceipts.items, page],
  );

  const hasMore = items.length < filteredReceipts.totalCount;
  const loadMore = useCallback(() => setPage((prev) => prev + 1), []);

  return {
    receipts: savedReceipts,
    items,
    allItems: filteredReceipts.items,
    totalCount: filteredReceipts.totalCount,
    hasMore,
    loadMore,
    isLoading,
    filters,
    setFilters,
    searchQuery,
    setSearchQuery,
    refetch,
  };
}
