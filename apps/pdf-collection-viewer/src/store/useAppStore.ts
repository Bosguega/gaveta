import { create } from 'zustand';
import { DEFAULT_ITEMS_PER_PAGE, ITEMS_PER_PAGE_OPTIONS, type GridDensity, type ViewMode } from '@/types';
import type { Collection, CollectionItem, ScanProgress } from '@/types';

const ITEMS_PER_PAGE_KEY = 'pdf-collection-viewer:items-per-page';
const GRID_DENSITY_KEY = 'pdf-collection-viewer:grid-density';
const VIEW_MODE_KEY = 'pdf-collection-viewer:view-mode';

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

function loadGridDensity(): GridDensity {
    try {
        const raw = localStorage.getItem(GRID_DENSITY_KEY) as GridDensity;
        if (raw === 'compact' || raw === 'normal' || raw === 'large') {
            return raw;
        }
    } catch {
        // fall through
    }
    return 'normal';
}

function loadViewMode(): ViewMode {
    try {
        const raw = localStorage.getItem(VIEW_MODE_KEY) as ViewMode;
        if (raw === 'flat' || raw === 'folder') {
            return raw;
        }
    } catch {
        // fall through
    }
    return 'flat';
}

interface AppState {
    navigationVersion: number;
    itemsLoaded: boolean;
    setItemFavorite: (id: number, isFavorite: boolean) => void;
    // Navigation
    currentCollectionId: number | null;
    focusedItemId: number | null;
    openCollection: (id: number, focusedItemId?: number | null) => void;
    closeCollection: () => void;
    setFocusedItemId: (id: number | null) => void;

    // Collections
    collections: Collection[];
    setCollections: (collections: Collection[]) => void;

    // Items
    items: CollectionItem[];
    setItems: (items: CollectionItem[]) => void;

    // Selection
    selectedItemIds: Set<number>;
    toggleItemSelection: (id: number) => void;
    setSelectedItems: (ids: number[]) => void;
    clearSelection: () => void;

    // Preferences (persisted)
    itemsPerPage: number;
    setItemsPerPage: (count: number) => void;
    gridDensity: GridDensity;
    setGridDensity: (density: GridDensity) => void;
    viewMode: ViewMode;
    setViewMode: (mode: ViewMode) => void;

    // Scope (collection ids or null = all) used by the favorites virtual collection
    favoritesScope: number[] | null;
    setFavoritesScope: (ids: number[] | null) => void;

    // Update state
    isUpdating: boolean;
    updateProgress: ScanProgress | null;
    setIsUpdating: (isUpdating: boolean) => void;
    setUpdateProgress: (progress: ScanProgress | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
    navigationVersion: 0,
    itemsLoaded: false,
    setItemFavorite: (id, isFavorite) => set((state) => ({
        items: state.items.map((item) => item.id === id ? { ...item, is_favorite: isFavorite } : item),
    })),
    currentCollectionId: null,
    focusedItemId: null,
    openCollection: (id, focusedItemId = null) => set((state) => ({
        currentCollectionId: id, focusedItemId, items: [], itemsLoaded: false,
        selectedItemIds: new Set<number>(), navigationVersion: state.navigationVersion + 1,
    })),
    closeCollection: () => set((state) => ({
        currentCollectionId: null, focusedItemId: null, items: [], itemsLoaded: false,
        selectedItemIds: new Set<number>(), navigationVersion: state.navigationVersion + 1,
    })),
    setFocusedItemId: (id) => set({ focusedItemId: id }),

    collections: [],
    setCollections: (collections) => set({ collections }),

    items: [],
    setItems: (items) => set({ items, itemsLoaded: true }),

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
            // persistence best effort
        }
        set({ itemsPerPage: count });
    },

    gridDensity: loadGridDensity(),
    setGridDensity: (gridDensity) => {
        try {
            localStorage.setItem(GRID_DENSITY_KEY, gridDensity);
        } catch {
            // persistence best effort
        }
        set({ gridDensity });
    },

    viewMode: loadViewMode(),
    setViewMode: (viewMode) => {
        try {
            localStorage.setItem(VIEW_MODE_KEY, viewMode);
        } catch {
            // persistence best effort
        }
        set({ viewMode });
    },

    favoritesScope: null,
    setFavoritesScope: (favoritesScope) => set({ favoritesScope }),

    isUpdating: false,
    updateProgress: null,
    setIsUpdating: (isUpdating) => set({ isUpdating }),
    setUpdateProgress: (updateProgress) => set({ updateProgress }),
}));

