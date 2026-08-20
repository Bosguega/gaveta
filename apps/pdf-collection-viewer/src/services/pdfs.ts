import { invoke } from '@tauri-apps/api/core';
import type { DuplicateAnalysis, Pdf, RemoveDuplicateResult, ScanProgress, UpdateResult } from '@/types';

export async function listPdfs(collectionId: number): Promise<Pdf[]> {
    return invoke<Pdf[]>('list_pdfs', { collectionId });
}

export async function updateCollectionScan(collectionId: number): Promise<UpdateResult> {
    return invoke<UpdateResult>('update_collection_scan', { collectionId });
}

export async function cancelScan(collectionId?: number): Promise<boolean> {
    return invoke<boolean>('cancel_scan', { collectionId });
}

export async function openPdf(path: string): Promise<void> {
    return invoke<void>('open_pdf', { path });
}

export async function analyzeDuplicates(collectionId: number): Promise<DuplicateAnalysis> {
    return invoke<DuplicateAnalysis>('analyze_duplicates', { collectionId });
}

export async function removeDuplicate(
    collectionId: number,
    pdfId: number,
    deleteFromDisk: boolean,
    expectedHash?: string,
): Promise<RemoveDuplicateResult> {
    return invoke<RemoveDuplicateResult>('remove_duplicate', {
        collectionId,
        pdfId,
        deleteFromDisk,
        expectedHash,
    });
}

export async function revealInFolder(path: string): Promise<void> {
    return invoke<void>('reveal_in_folder', { path });
}

export function listenToUpdateProgress(callback: (progress: ScanProgress) => void): () => void {
    let unlisten: (() => void) | undefined;
    let cancelled = false;

    import('@tauri-apps/api/event')
        .then(({ listen }) =>
            listen<ScanProgress>('update-progress', (event) => {
                if (!cancelled) {
                    callback(event.payload);
                }
            }).then((fn) => {
                if (cancelled) {
                    fn();
                } else {
                    unlisten = fn;
                }
            }),
        )
        .catch(() => {
            // Event system not available (e.g. browser dev)
        });

    return () => {
        cancelled = true;
        unlisten?.();
        unlisten = undefined;
    };
}

export function listenToAnalyzeProgress(callback: (progress: ScanProgress) => void): () => void {
    let unlisten: (() => void) | undefined;
    let cancelled = false;

    import('@tauri-apps/api/event')
        .then(({ listen }) =>
            listen<ScanProgress>('analyze-progress', (event) => {
                if (!cancelled) {
                    callback(event.payload);
                }
            }).then((fn) => {
                if (cancelled) {
                    fn();
                } else {
                    unlisten = fn;
                }
            }),
        )
        .catch(() => {
            // Event system not available (e.g. browser dev)
        });

    return () => {
        cancelled = true;
        unlisten?.();
        unlisten = undefined;
    };
}
