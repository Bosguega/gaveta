import { invoke } from '@tauri-apps/api/core';
import type {
    ContentSearchResult,
    FileIndexStatusItem,
} from '@/types';

/** Full-text search over indexed PDF page content. */
export async function searchContent(
    query: string,
    limit?: number,
    collectionIds?: number[] | null,
): Promise<ContentSearchResult[]> {
    return invoke<ContentSearchResult[]>('search_content', {
        query,
        limit,
        collectionIds: collectionIds ?? null,
    });
}

/** Indexes every pending PDF in the given collections (null = all). */
export async function indexPdfs(collectionIds?: number[] | null): Promise<void> {
    return invoke('index_pdfs', { collectionIds: collectionIds ?? null });
}

export async function cancelIndexing(): Promise<boolean> {
    return invoke<boolean>('cancel_indexing');
}

export async function indexItem(itemId: number): Promise<string> {
    return invoke<string>('index_item', { itemId });
}

export async function getIndexStatus(
    collectionIds?: number[] | null,
): Promise<FileIndexStatusItem[]> {
    return invoke<FileIndexStatusItem[]>('get_index_status', {
        collectionIds: collectionIds ?? null,
    });
}
