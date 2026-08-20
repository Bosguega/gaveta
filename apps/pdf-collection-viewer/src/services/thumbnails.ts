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

export async function getThumbnailUrl(
    thumbnailKey: string | null,
    version?: string | number | null,
): Promise<string> {
    if (!thumbnailKey) {
        return '';
    }

    const cacheKey = version == null ? thumbnailKey : `${thumbnailKey}@${version}`;
    const cached = THUMBNAIL_URL_CACHE.get(cacheKey);
    if (cached) {
        return cached;
    }

    const promise = (async () => {
        const cacheDir = await getCacheDirOnce();
        const fullPath = await join(cacheDir, thumbnailKey);
        const url = convertFileSrc(fullPath);
        // A3/A4: bust the asset-protocol/browser cache when the underlying
        // file changed (size/modified_at) so a regenerated .webp is refetched
        // even though the thumbnail key (sha256 of path) stays the same.
        return version == null ? url : `${url}?v=${encodeURIComponent(String(version))}`;
    })();

    promise.catch(() => {
        THUMBNAIL_URL_CACHE.delete(cacheKey);
    });

    THUMBNAIL_URL_CACHE.set(cacheKey, promise);
    return promise;
}