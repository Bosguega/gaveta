import { convertFileSrc } from '@tauri-apps/api/core';
import { invoke } from '@tauri-apps/api/core';
import { join } from '@tauri-apps/api/path';

const THUMBNAIL_URL_CACHE = new Map<string, Promise<string>>();
let CACHE_DIR_PROMISE: Promise<string> | null = null;

function getCacheDirOnce(): Promise<string> {
    if (!CACHE_DIR_PROMISE) {
        CACHE_DIR_PROMISE = invoke<string>('get_cache_dir');
        CACHE_DIR_PROMISE.catch(() => {
            CACHE_DIR_PROMISE = null;
        });
    }
    return CACHE_DIR_PROMISE;
}

export function clearThumbnailUrlCache(): void {
    THUMBNAIL_URL_CACHE.clear();
    CACHE_DIR_PROMISE = null;
}

export async function getThumbnailUrl(thumbnailKey: string | null): Promise<string> {
    if (!thumbnailKey) {
        return '';
    }

    const cached = THUMBNAIL_URL_CACHE.get(thumbnailKey);
    if (cached) {
        return cached;
    }

    const promise = (async () => {
        const cacheDir = await getCacheDirOnce();
        const fullPath = await join(cacheDir, thumbnailKey);
        return convertFileSrc(fullPath);
    })();

    promise.catch(() => {
        THUMBNAIL_URL_CACHE.delete(thumbnailKey);
    });

    THUMBNAIL_URL_CACHE.set(thumbnailKey, promise);
    return promise;
}