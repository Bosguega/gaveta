import { useEffect, useRef, useState } from 'react';
import type { CollectionItem } from '@/types';
import { formatBytes, formatColorChanges, formatColorCount, formatEmbroiderySize, formatPageCount, formatStitchCount } from '@/utils/format';
import { ItemThumbnail } from '@/components/common/ItemThumbnail';

interface Props {
    item: CollectionItem;
    selected: boolean;
    /** Changes whenever thumbnails are regenerated so cached URLs are refetched. */
    refreshKey?: number;
    onSelect: () => void;
    onOpen: () => void;
    onRevealInFolder: () => void;
    onToggleFavorite: () => void;
}

export function ItemCard({ item, selected, refreshKey, onSelect, onOpen, onRevealInFolder, onToggleFavorite }: Props) {
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
    const contextMenuRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (contextMenuRef.current && !contextMenuRef.current.contains(event.target as Node)) {
                setContextMenu(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const isEmbroidery = item.file_type === 'embroidery';
    const embroideryDetails = [
        formatStitchCount(item.stitch_count),
        formatColorCount(item.color_count),
        formatColorChanges(item.color_changes),
        formatEmbroiderySize(item.design_width_mm, item.design_height_mm),
    ].filter(Boolean);

    const handleContextMenu = (event: React.MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();
        // Clamp position so the menu stays inside the viewport.
        const menuWidth = 200;
        const menuHeight = 120;
        const x = Math.min(event.clientX, window.innerWidth - menuWidth - 8);
        const y = Math.min(event.clientY, window.innerHeight - menuHeight - 8);
        setContextMenu({ x: Math.max(0, x), y: Math.max(0, y) });
    };

    const handleMenuItemClick = (action: () => void) => {
        setContextMenu(null);
        action();
    };

    return (
        <>
            <div
                className={`group relative bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow cursor-pointer overflow-hidden ${selected ? 'ring-2 ring-blue-500' : ''}`}
                onClick={onSelect}
                onDoubleClick={onOpen}
                onContextMenu={handleContextMenu}
                title={item.path}
            >
                <div className="aspect-[3/4] bg-slate-100 flex items-center justify-center overflow-hidden relative">
                    <ItemThumbnail
                        item={item}
                        refreshKey={refreshKey}
                        size="full"
                    />

                    <button
                        type="button"
                        onClick={(event) => {
                            event.stopPropagation();
                            onToggleFavorite();
                        }}
                        onDoubleClick={(event) => event.stopPropagation()}
                        className={`absolute top-2 left-2 w-8 h-8 rounded-full flex items-center justify-center text-lg shadow-sm backdrop-blur-sm transition-colors ${item.is_favorite
                            ? 'bg-amber-400/90 hover:bg-amber-500 text-white'
                            : 'bg-white/80 hover:bg-white text-slate-400 hover:text-amber-500 opacity-0 group-hover:opacity-100'
                            }`}
                        title={item.is_favorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                    >
                        ★
                    </button>
                    <button
                        type="button"
                        onClick={(event) => {
                            event.stopPropagation();
                            onOpen();
                        }}
                        onDoubleClick={(event) => event.stopPropagation()}
                        className="absolute top-2 right-2 px-2.5 py-1.5 rounded-lg bg-blue-600/90 hover:bg-blue-700 text-white text-xs font-medium shadow-sm opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm"
                        title="Abrir arquivo"
                    >
                        Abrir ↗
                    </button>
                </div>


                <div className="p-3">
                    <div className="font-medium text-sm text-slate-800 truncate" title={item.filename}>
                        {item.filename}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                        {formatBytes(item.size)}
                        {isEmbroidery && item.stitch_count
                            ? <> · {formatStitchCount(item.stitch_count)}</>
                            : <> · {formatPageCount(item.page_count, item.file_type)}</>}
                    </div>
                    {isEmbroidery && embroideryDetails.length > 1 && (
                        <div className="text-xs text-slate-400 mt-0.5" title={embroideryDetails.join(' · ')}>
                            {embroideryDetails.slice(1).join(' · ')}
                        </div>
                    )}
                </div>
            </div>

            {contextMenu && (
                <div
                    ref={contextMenuRef}
                    className="fixed z-50 bg-white border border-slate-200 rounded-lg shadow-lg py-1 min-w-[200px]"
                    style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
                >
                    <button
                        type="button"
                        onClick={() => handleMenuItemClick(onOpen)}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                    >
                        <span>↗</span>
                        <span>Abrir</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => handleMenuItemClick(onRevealInFolder)}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                    >
                        <span>📁</span>
                        <span>Abrir local do arquivo</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => handleMenuItemClick(onToggleFavorite)}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                    >
                        <span>{item.is_favorite ? '★' : '☆'}</span>
                        <span>{item.is_favorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}</span>
                    </button>
                </div>
            )}
        </>
    );
}
