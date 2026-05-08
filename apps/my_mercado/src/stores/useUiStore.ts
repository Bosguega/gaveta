import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { AppTab, HistoryFilters, SearchFilters, SearchSortBy, SortDirection } from "../types/ui";

type UiState = {
  tab: AppTab;
  setTab: (tab: AppTab) => void;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  sortOrder: SearchSortBy;
  setSortOrder: (value: SearchSortBy) => void;
  searchSortDirection: SortDirection;
  setSearchSortDirection: (value: SortDirection) => void;
  searchFilters: SearchFilters;
  setSearchFilters: (
    value: SearchFilters | ((prev: SearchFilters) => SearchFilters),
  ) => void;
  historyFilter: string;
  setHistoryFilter: (value: string) => void;
  historyFilters: HistoryFilters;
  setHistoryFilters: (
    value: HistoryFilters | ((prev: HistoryFilters) => HistoryFilters),
  ) => void;
  expandedReceipts: string[];
  setExpandedReceipts: (
    value: string[] | ((prev: string[]) => string[]),
  ) => void;
};

const DEFAULT_HISTORY_FILTERS: HistoryFilters = {
  period: "all",
  sortBy: "date",
  sortOrder: "desc",
  startDate: "",
  endDate: "",
};

const DEFAULT_SEARCH_FILTERS: SearchFilters = {
  period: "all",
  startDate: "",
  endDate: "",
};

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      tab: "scan",
      setTab: (tab) => set({ tab }),
      searchQuery: "",
      setSearchQuery: (value) => set({ searchQuery: value }),
      sortOrder: "recent",
      setSortOrder: (value) => set({ sortOrder: value }),
      searchSortDirection: "desc",
      setSearchSortDirection: (value) => set({ searchSortDirection: value }),
      searchFilters: DEFAULT_SEARCH_FILTERS,
      setSearchFilters: (value) =>
        set((state) => ({
          searchFilters:
            typeof value === "function" ? value(state.searchFilters) : value,
        })),
      historyFilter: "",
      setHistoryFilter: (value) => set({ historyFilter: value }),
      historyFilters: DEFAULT_HISTORY_FILTERS,
      setHistoryFilters: (value) =>
        set((state) => ({
          historyFilters:
            typeof value === "function" ? value(state.historyFilters) : value,
        })),
      expandedReceipts: [],
      setExpandedReceipts: (value) =>
        set((state) => ({
          expandedReceipts:
            typeof value === "function" ? value(state.expandedReceipts) : value,
        })),
    }),
    {
      name: "@MyMercado:ui",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ tab: state.tab }),
    },
  ),
);
