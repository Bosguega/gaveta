import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type {
    CollectionItem,
    DuplicateAnalysis,
    RemoveDuplicateResult,
    ScanProgress,
    UpdateResult,
} from '@/types';

export async function listItems(collectionId: number): Promise<CollectionItem[]> {
    return invoke<CollectionItem[]>('list_items', { collectionId });
}

export async function updateCollectionScan(collectionId: number): Promise<UpdateResult> {
    return invoke<UpdateResult>('update_collection_scan', { collectionId });
}

export async function cancelScan(collectionId?: number): Promise<boolean> {
    return invoke<boolean>('cancel_scan', { collectionId });
}

export async function openFile(path: string): Promise<void> {
    return invoke<void>('open_file', { path });
}

export async function toggleFavorite(itemId: number): Promise<boolean> {
    return invoke<boolean>('toggle_favorite', { itemId });
}

export async function analyzeDuplicates(collectionId: number): Promise<DuplicateAnalysis> {
    return invoke<DuplicateAnalysis>('analyze_duplicates', { collectionId });
}

export async function removeDuplicate(
    collectionId: number,
    itemId: number,
    deleteFromDisk: boolean,
    expectedHash?: string,
): Promise<RemoveDuplicateResult> {
    return invoke<RemoveDuplicateResult>('remove_duplicate', {
        collectionId,
        itemId,
        deleteFromDisk,
        expectedHash,
    });
}

export async function revealInFolder(path: string): Promise<void> {
    return invoke<void>('reveal_in_folder', { path });
}

function listenToProgress(
    eventName: string,
    callback: (progress: ScanProgress) => void,
): () => void {
    let disposed = false;
    let unlisten: (() => void) | null = null;

    listen<ScanProgress>(eventName, (event) => {
        if (!disposed) {
            callback(event.payload);
        }
    }).then((fn) => {
        if (disposed) {
            fn();
        } else {
            unlisten = fn;
        }
    });

    return () => {
        disposed = true;
        unlisten?.();
    };
}

export function listenToUpdateProgress(callback: (progress: ScanProgress) => void): () => void {
    return listenToProgress('update-progress', callback);
}

export function listenToAnalyzeProgress(callback: (progress: ScanProgress) => void): () => void {
    return listenToProgress('analyze-progress', callback);
}
