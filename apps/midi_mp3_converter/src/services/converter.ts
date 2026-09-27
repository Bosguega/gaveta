import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { convertFileSrc } from '@tauri-apps/api/core';
import type { ProgressEvent, QueueItem, Settings, SoundFontOption, Summary } from '@/types';

export function listQueue(): Promise<QueueItem[]> {
    return invoke('list_queue');
}

export function addFiles(paths: string[]): Promise<QueueItem[]> {
    return invoke('add_files', { paths });
}

export function addFolder(path: string, includeSubfolders?: boolean): Promise<QueueItem[]> {
    return invoke('add_folder', { path, includeSubfolders });
}

export function addPaths(paths: string[], includeSubfolders?: boolean): Promise<QueueItem[]> {
    return invoke('add_paths', { paths, includeSubfolders });
}

export function removeItems(ids: number[]): Promise<QueueItem[]> {
    return invoke('remove_items', { ids });
}

export function clearCompleted(): Promise<QueueItem[]> {
    return invoke('clear_completed');
}

export function clearQueue(): Promise<QueueItem[]> {
    return invoke('clear_queue');
}

export function getSettings(): Promise<Settings> {
    return invoke('get_settings');
}

export function saveSettings(settings: Settings): Promise<Settings> {
    return invoke('set_settings', { settings });
}

export function listSoundFonts(): Promise<SoundFontOption[]> {
    return invoke('soundfonts');
}

export function startConversion(): Promise<void> {
    return invoke('start_conversion');
}

export function cancelConversion(): Promise<void> {
    return invoke('cancel_conversion');
}

export function renderPreview(id: number): Promise<string> {
    return invoke('render_preview', { id });
}

export function clearPreview(): Promise<void> {
    return invoke('clear_preview');
}

export function revealInFolder(path: string): Promise<void> {
    return invoke('reveal_in_folder', { path });
}

export function openFolder(path: string): Promise<void> {
    return invoke('open_folder', { path });
}

export function audioSource(filePath: string): string {
    return convertFileSrc(filePath);
}

export function onProgress(callback: (event: ProgressEvent) => void): Promise<UnlistenFn> {
    return listen<ProgressEvent>('conversion-progress', (event) => callback(event.payload));
}

export function onDone(callback: (summary: Summary) => void): Promise<UnlistenFn> {
    return listen<Summary>('conversion-done', (event) => callback(event.payload));
}