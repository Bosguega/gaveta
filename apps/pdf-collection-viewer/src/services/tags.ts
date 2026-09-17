import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { ItemTags, TagSettings, TaggingProgress, TaggingSummary } from '@/types';
import { useTagJobStore } from '@/store/useTagJobStore';

let listenersAttached = false;

/** Ensures global Tauri event listeners are registered once. */
export async function ensureTagJobListeners(): Promise<void> {
    if (listenersAttached) return;
    listenersAttached = true;

    try {
        await listen<TaggingProgress>('tagging-progress', (event) => {
            useTagJobStore.getState().progress(event.payload);
        });

        await listen<TaggingSummary>('tagging-done', (event) => {
            useTagJobStore.getState().finish(event.payload);
        });
    } catch (e) {
        listenersAttached = false;
        console.error('Falha ao registrar listeners de tagging:', e);
    }
}

export async function getTagSettings(): Promise<TagSettings> {
    return invoke<TagSettings>('get_tag_settings');
}

export async function setTagSettings(settings: TagSettings): Promise<void> {
    return invoke<void>('set_tag_settings', { settings });
}

export async function testTagConnection(settings: TagSettings): Promise<string> {
    return invoke<string>('test_tag_connection', { settings });
}

export async function getItemTags(itemIds: number[]): Promise<ItemTags[]> {
    if (itemIds.length === 0) return [];
    return invoke<ItemTags[]>('get_item_tags', { itemIds });
}

export async function generateItemTags(itemId: number): Promise<string[]> {
    const tags = await invoke<string[]>('generate_item_tags', { itemId });
    useTagJobStore.getState().invalidateTags();
    return tags;
}

/** Starts the batch job; results arrive via tagging-progress/tagging-done events. */
export async function generateCollectionTags(
    collectionId: number,
    onlyMissing: boolean,
): Promise<void> {
    if (useTagJobStore.getState().jobs[collectionId]?.running) return;
    await ensureTagJobListeners();
    useTagJobStore.getState().begin(collectionId);
    try {
        await invoke<void>('generate_collection_tags', { collectionId, onlyMissing });
    } catch (reason) {
        useTagJobStore.getState().fail(
            collectionId,
            reason instanceof Error ? reason.message : String(reason),
        );
        throw reason;
    }
}

export async function cancelTagging(collectionId: number): Promise<boolean> {
    return invoke<boolean>('cancel_tagging', { collectionId });
}

export function listenToTaggingProgress(
    callback: (progress: TaggingProgress) => void,
): () => void {
    let disposed = false;
    let unlisten: (() => void) | null = null;
    listen<TaggingProgress>('tagging-progress', (event) => {
        if (!disposed) callback(event.payload);
    }).then((fn) => {
        if (disposed) fn();
        else unlisten = fn;
    });
    return () => {
        disposed = true;
        unlisten?.();
    };
}

export function listenToTaggingDone(
    callback: (summary: TaggingSummary) => void,
): () => void {
    let disposed = false;
    let unlisten: (() => void) | null = null;
    listen<TaggingSummary>('tagging-done', (event) => {
        if (!disposed) callback(event.payload);
    }).then((fn) => {
        if (disposed) fn();
        else unlisten = fn;
    });
    return () => {
        disposed = true;
        unlisten?.();
    };
}