import { create } from 'zustand';
import type { Collection, Pdf, ScanProgress } from '@/types';

interface AppState {
    // Navigation
    currentCollectionId: number | null;
    openCollection: (id: number) => void;
    closeCollection: () => void;

    // Collections
    collections: Collection[];
    setCollections: (collections: Collection[]) => void;

    // PDFs
    pdfs: Pdf[];
    setPdfs: (pdfs: Pdf[]) => void;

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

    pdfs: [],
    setPdfs: (pdfs) => set({ pdfs }),

    isUpdating: false,
    updateProgress: null,
    setIsUpdating: (isUpdating) => set({ isUpdating }),
    setUpdateProgress: (updateProgress) => set({ updateProgress }),
}));