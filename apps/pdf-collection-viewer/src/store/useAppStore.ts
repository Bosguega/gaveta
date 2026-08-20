import { create } from 'zustand';
import type { Collection, CollectionItem, ScanProgress } from '@/types';

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

    isUpdating: false,
    updateProgress: null,
    setIsUpdating: (isUpdating) => set({ isUpdating }),
    setUpdateProgress: (updateProgress) => set({ updateProgress }),
}));
