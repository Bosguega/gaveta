import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { z } from 'zod';
import type { ProgressEvent, QueueItem, Settings, SoundFontOption, Summary } from '@/types';

const progressSchema = z.object({
    id: z.number(),
    index: z.number(),
    total: z.number(),
    name: z.string(),
    phase: z.string(),
    itemPercent: z.number(),
    batchPercent: z.number(),
    outputPath: z.string().nullable(),
    status: z.enum(['pending', 'running', 'done', 'skipped', 'error', 'canceled']),
    error: z.string().nullable(),
    durationMs: z.number().nullable(),
});

const summarySchema = z.object({
    done: z.number(),
    skipped: z.number(),
    failed: z.number(),
    canceled: z.boolean(),
    elapsedMs: z.number(),
    errors: z.array(z.object({ name: z.string(), message: z.string() })),
});

export const listQueue = (): Promise<QueueItem[]> => invoke('list_queue');

export const addPaths = (paths: string[]): Promise<QueueItem[]> =>
    invoke('add_paths', { paths, includeSubfolders: null });

export const removeItems = (ids: number[]): Promise<QueueItem[]> => invoke('remove_items', { ids });

export const clearQueue = (): Promise<QueueItem[]> => invoke('clear_queue');

export const getSettings = (): Promise<Settings> => invoke('get_settings');

export const saveSettings = (settings: Settings): Promise<Settings> =>
    invoke('set_settings', { settings });

export const listSoundFonts = (): Promise<SoundFontOption[]> => invoke('soundfonts');

export const startConversion = (): Promise<void> => invoke('start_conversion');

export const cancelConversion = (): Promise<void> => invoke('cancel_conversion');

export const renderPreview = (id: number): Promise<string> => invoke('render_preview', { id });

export const clearPreview = (): Promise<void> => invoke('clear_preview');

export const revealInFolder = (path: string): Promise<void> => invoke('reveal_in_folder', { path });

export const audioSource = (path: string): string => convertFileSrc(path);

export function onProgress(handler: (event: ProgressEvent) => void): Promise<UnlistenFn> {
    return listen('conversion-progress', (event) => {
        const parsed = progressSchema.safeParse(event.payload);
        if (!parsed.success) {
            console.warn('payload inesperado em conversion-progress', parsed.error.issues);
            return;
        }
        handler(parsed.data);
    });
}

export function onDone(handler: (summary: Summary) => void): Promise<UnlistenFn> {
    return listen('conversion-done', (event) => {
        const parsed = summarySchema.safeParse(event.payload);
        if (!parsed.success) {
            console.warn('payload inesperado em conversion-done', parsed.error.issues);
            return;
        }
        handler(parsed.data);
    });
}