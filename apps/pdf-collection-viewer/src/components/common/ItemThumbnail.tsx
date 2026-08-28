import { useEffect, useState } from 'react';
import { getThumbnailUrl } from '@/services/thumbnails';
import { getFileTypeIcon } from '@/utils/format';

export interface ThumbnailItemSource {
    thumbnail_key: string | null;
    thumbnail_status: string;
    modified_at: string;
    file_type: string;
    filename: string;
}

interface ItemThumbnailProps {
    item: ThumbnailItemSource;
    refreshKey?: number;
    size?: 'sm' | 'full';
    className?: string;
}

export function ItemThumbnail({ item, refreshKey, size = 'full', className = '' }: ItemThumbnailProps) {
    const [imgSrc, setImgSrc] = useState<string>('');

    useEffect(() => {
        let active = true;
        if (item.thumbnail_status === 'ready' && item.thumbnail_key) {
            const version =
                refreshKey && refreshKey > 0
                    ? `${item.modified_at}@r${refreshKey}`
                    : item.modified_at;
            getThumbnailUrl(item.thumbnail_key, version)
                .then((url) => {
                    if (active) {
                        setImgSrc(url);
                    }
                })
                .catch(() => {
                    if (active) {
                        setImgSrc('');
                    }
                });
        } else {
            setImgSrc('');
        }
        return () => {
            active = false;
        };
    }, [item.thumbnail_key, item.thumbnail_status, item.modified_at, refreshKey]);

    const showPlaceholder = !imgSrc || item.thumbnail_status !== 'ready';

    if (size === 'sm') {
        if (!showPlaceholder) {
            return (
                <img
                    src={imgSrc}
                    alt={item.filename}
                    className={`w-12 h-16 object-cover rounded-md border border-slate-200 ${className}`}
                    loading="lazy"
                    onError={() => setImgSrc('')}
                />
            );
        }

        return (
            <div className={`w-12 h-16 flex items-center justify-center bg-slate-100 rounded-md border border-slate-200 text-slate-400 ${className}`}>
                <span className="text-xl">{getFileTypeIcon(item.file_type)}</span>
            </div>
        );
    }

    // Default 'full' size for grid cards
    return (
        <div className={`w-full h-full flex items-center justify-center ${className}`}>
            {!showPlaceholder ? (
                <img
                    src={imgSrc}
                    alt={item.filename}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    onError={() => setImgSrc('')}
                />
            ) : (
                <div className="flex flex-col items-center justify-center text-slate-400 p-2 text-center">
                    <span className="text-4xl mb-2">{getFileTypeIcon(item.file_type)}</span>
                    <span className="text-xs">
                        {item.thumbnail_status === 'error' ? 'Miniatura indisponível' : 'Sem miniatura'}
                    </span>
                </div>
            )}
        </div>
    );
}
