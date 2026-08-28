import { invoke } from '@tauri-apps/api/core';
import type { Collection, CollectionDetail } from '@/types';

export async function listCollections(): Promise<Collection[]> {
    return invoke<Collection[]>('list_collections');
}

export async function getCollection(id: number): Promise<CollectionDetail | null> {
    return invoke<CollectionDetail | null>('get_collection', { id });
}

export async function createCollection(
    name: string,
    icon: string,
    iconPath: string | null,
    paths: string[],
    includeSubfolders: boolean,
): Promise<Collection> {
    return invoke<Collection>('create_collection', {
        name,
        icon,
        iconPath,
        paths,
        includeSubfolders,
    });
}

export async function updateCollection(
    id: number,
    name: string,
    icon: string,
    iconPath: string | null,
    paths: string[],
    includeSubfolders: boolean,
): Promise<void> {
    return invoke<void>('update_collection', {
        id,
        name,
        icon,
        iconPath,
        paths,
        includeSubfolders,
    });
}

export async function deleteCollection(id: number): Promise<void> {
    return invoke<void>('delete_collection', { id });
}

export async function pickFolder(): Promise<string | null> {
    return invoke<string | null>('pick_folder');
}

export async function pickImageFile(): Promise<string | null> {
    return invoke<string | null>('pick_image_file');
}

export interface CoverCropRect {
    cropX: number;
    cropY: number;
    cropW: number;
    cropH: number;
}

export async function saveCollectionCover(srcPath: string, rect: CoverCropRect): Promise<string> {
    return invoke<string>('save_collection_cover', {
        srcPath,
        cropX: rect.cropX,
        cropY: rect.cropY,
        cropW: rect.cropW,
        cropH: rect.cropH,
    });
}

export async function toggleCollectionPin(id: number): Promise<boolean> {
    return invoke<boolean>('toggle_collection_pin', { id });
}

