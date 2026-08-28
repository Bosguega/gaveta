import { create } from 'zustand';
import { DEFAULT_ITEMS_PER_PAGE, ITEMS_PER_PAGE_OPTIONS } from '@/types';
import type { Collection, CollectionItem, ScanProgress } from '@/types';

const ITEMS_PER_PAGE_KEY = 'pdf-collection-viewer:items-per-page';

// Persisted in localStorage: only the page-size preference, never the
// current page (that is ephemeral UI state).
function loadItemsPerPage(): number {
    try {
        const raw = localStorage.getItem(ITEMS_PER_PAGE_KEY);
        const parsed = raw === null ? Number.NaN : Number.parseInt(raw, 10);
        if (ITEMS_PER_PAGE_OPTIONS.includes(parsed)) {
            return parsed;
        }
    } catch {
        // localStorage unavailable: fall through to the default.
    }
    return DEFAULT_ITEMS_PER_PAGE;
}

interface AppState {
    // Navigation
    currentCollectionId: number | null;
    openCollection: (id: number) => void;
    closeCollection: () => void;

    // Collections
    collections: Collection[];
    setCollections: (collections: Collection[]) => void;

    // Items
    items: CollectionItem[];
    setItems: (items: CollectionItem[]) => void;

    // Selection (generic, reusable by future batch actions)
    selectedItemIds: Set<number>;
    toggleItemSelection: (id: number) => void;
    setSelectedItems: (ids: number[]) => void;
    clearSelection: () => void;

    // Pagination preference (persisted; the current page is not)
    itemsPerPage: number;
    setItemsPerPage: (count: number) => void;

    // Update state
    isUpdating: boolean;
    updateProgress: ScanProgress | null;
    setIsUpdating: (isUpdating: boolean) => void;
    setUpdateProgress: (progress: ScanProgress | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
    currentCollectionId: null,
    openCollection: (id) => set({ currentCollectionId: id }),
    closeCollection: () => set({ currentCollectionId: null }),

    collections: [],
    setCollections: (collections) => set({ collections }),

    items: [],
    setItems: (items) => set({ items }),

    selectedItemIds: new Set<number>(),
    toggleItemSelection: (id) =>
        set((state) => {
            const next = new Set(state.selectedItemIds);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return { selectedItemIds: next };
        }),
    setSelectedItems: (ids) => set({ selectedItemIds: new Set(ids) }),
    clearSelection: () => set({ selectedItemIds: new Set<number>() }),

    itemsPerPage: loadItemsPerPage(),
    setItemsPerPage: (count) => {
        try {
            localStorage.setItem(ITEMS_PER_PAGE_KEY, String(count));
        } catch {
            // Persistence is best-effort; the in-memory value still applies.
        }
        set({ itemsPerPage: count });
    },

    isUpdating: false,
    updateProgress: null,
    setIsUpdating: (isUpdating) => set({ isUpdating }),
    setUpdateProgress: (updateProgress) => set({ updateProgress }),
}));
