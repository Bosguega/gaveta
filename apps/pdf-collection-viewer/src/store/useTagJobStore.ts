import { create } from 'zustand';
import type { TaggingProgress, TaggingSummary } from '@/types';

export interface TagJob {
    running: boolean;
    progress: TaggingProgress | null;
    summary: TaggingSummary | null;
    error: string | null;
}

export interface TagJobState {
    jobs: Record<number, TagJob>;
    revision: number;
    invalidateTags: () => void;
    begin: (collectionId: number) => void;
    progress: (event: TaggingProgress) => void;
    finish: (event: TaggingSummary) => void;
    fail: (collectionId: number, error: string) => void;
    clearSummary: (collectionId: number) => void;
}

export const useTagJobStore = create<TagJobState>((set) => ({
    jobs: {},
    revision: 0,
    invalidateTags: () => set((state) => ({ revision: state.revision + 1 })),
    begin: (collectionId) => set((state) => ({
        jobs: {
            ...state.jobs,
            [collectionId]: {
                running: true,
                progress: null,
                summary: null,
                error: null,
            },
        },
    })),
    progress: (event) => set((state) => {
        const job = state.jobs[event.collection_id];
        return {
            jobs: {
                ...state.jobs,
                [event.collection_id]: {
                    running: true,
                    progress: event,
                    summary: job?.summary ?? null,
                    error: null,
                },
            },
        };
    }),
    finish: (event) => set((state) => ({
        revision: state.revision + 1,
        jobs: {
            ...state.jobs,
            [event.collection_id]: {
                running: false,
                progress: null,
                summary: event,
                error: null,
            },
        },
    })),
    fail: (collectionId, error) => set((state) => {
        const job = state.jobs[collectionId];
        return {
            jobs: {
                ...state.jobs,
                [collectionId]: {
                    running: false,
                    progress: null,
                    summary: job?.summary ?? null,
                    error,
                },
            },
        };
    }),
    clearSummary: (collectionId) => set((state) => {
        const job = state.jobs[collectionId];
        if (!job) return state;
        return {
            jobs: {
                ...state.jobs,
                [collectionId]: {
                    ...job,
                    summary: null,
                    error: null,
                },
            },
        };
    }),
}));
