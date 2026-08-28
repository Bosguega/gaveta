import { useEffect, useCallback } from 'react';
import type { CollectionItem } from '@/types';
import { ItemThumbnail } from '@/components/common/ItemThumbnail';
import {
    formatBytes,
    formatColorChanges,
    formatColorCount,
    formatEmbroiderySize,
    formatModifiedAt,
    formatPageCount,
    formatStitchCount,
    getFileTypeLabel,
} from '@/utils/format';

interface QuickLookModalProps {
    items: CollectionItem[];
    currentIndex: number;
    onClose: () => void;
    onNavigate: (index: number) => void;
    onOpenFile: (path: string) => void;
    onRevealInFolder: (path: string) => void;
    onToggleFavorite: (id: number) => void;
    refreshKey?: number;
}

export function QuickLookModal({
    items,
    currentIndex,
    onClose,
    onNavigate,
    onOpenFile,
    onRevealInFolder,
    onToggleFavorite,
    refreshKey,
}: QuickLookModalProps) {
    const item = items[currentIndex];

    const handlePrev = useCallback(() => {
        if (currentIndex > 0) {
            onNavigate(currentIndex - 1);
        }
    }, [currentIndex, onNavigate]);

    const handleNext = useCallback(() => {
        if (currentIndex < items.length - 1) {
            onNavigate(currentIndex + 1);
        }
    }, [currentIndex, items.length, onNavigate]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
            } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                handlePrev();
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                handleNext();
            } else if (e.key === ' ' && !['input', 'textarea'].includes((e.target as HTMLElement)?.tagName?.toLowerCase())) {
                e.preventDefault();
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handlePrev, handleNext, onClose]);

    if (!item) return null;

    const isEmbroidery = item.file_type === 'embroidery';
    const embroideryDetails = [
        formatStitchCount(item.stitch_count),
        formatColorCount(item.color_count),
        formatColorChanges(item.color_changes),
        formatEmbroiderySize(item.design_width_mm, item.design_height_mm),
    ].filter(Boolean);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-6">
            <div className="relative bg-slate-900 text-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-700">
                {/* Top header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
                    <div className="min-w-0 flex-1 mr-4">
                        <h2 className="text-base font-semibold truncate text-slate-100" title={item.filename}>
                            {item.filename}
                        </h2>
                        <p className="text-xs text-slate-400 truncate mt-0.5" title={item.path}>
                            {item.path}
                        </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                        <span className="text-xs text-slate-400 bg-slate-800 px-2.5 py-1 rounded-full border border-slate-700">
                            {currentIndex + 1} de {items.length}
                        </span>
                        <button
                            type="button"
                            onClick={() => onToggleFavorite(item.id)}
                            className={`p-1.5 rounded-lg text-lg transition-colors ${
                                item.is_favorite ? 'text-amber-400 hover:text-amber-300' : 'text-slate-500 hover:text-amber-400'
                            }`}
                            title={item.is_favorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                        >
                            ★
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 text-lg leading-none"
                            title="Fechar (Esc ou Espaço)"
                        >
                            ✕
                        </button>
                    </div>
                </div>

                {/* Main image / preview body */}
                <div className="flex-1 relative flex items-center justify-center p-6 bg-slate-950/80 min-h-[360px] overflow-hidden">
                    {/* Previous button */}
                    <button
                        type="button"
                        onClick={handlePrev}
                        disabled={currentIndex === 0}
                        className="absolute left-4 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-white flex items-center justify-center text-xl shadow-lg disabled:opacity-20 disabled:cursor-not-allowed transition-all"
                        title="Anterior (Seta Esquerda)"
                    >
                        ‹
                    </button>

                    {/* Image / Thumbnail */}
                    <div className="max-w-full max-h-[55vh] aspect-[3/4] flex items-center justify-center rounded-xl overflow-hidden shadow-2xl bg-slate-900 border border-slate-800">
                        <ItemThumbnail item={item} refreshKey={refreshKey} size="full" className="w-full h-full object-contain" />
                    </div>

                    {/* Next button */}
                    <button
                        type="button"
                        onClick={handleNext}
                        disabled={currentIndex === items.length - 1}
                        className="absolute right-4 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-white flex items-center justify-center text-xl shadow-lg disabled:opacity-20 disabled:cursor-not-allowed transition-all"
                        title="Próxima (Seta Direita)"
                    >
                        ›
                    </button>
                </div>

                {/* Footer details and actions */}
                <div className="px-6 py-4 border-t border-slate-800 bg-slate-900 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
                        <span className="px-2 py-1 bg-slate-800 rounded border border-slate-700 font-medium uppercase">
                            {getFileTypeLabel(item.file_type)}
                        </span>
                        <span>{formatBytes(item.size)}</span>
                        {item.modified_at && <span>· Modificado: {formatModifiedAt(item.modified_at)}</span>}
                        {isEmbroidery && embroideryDetails.length > 0 && (
                            <span className="text-blue-400">· {embroideryDetails.join(' · ')}</span>
                        )}
                        {!isEmbroidery && item.page_count !== null && (
                            <span>· {formatPageCount(item.page_count, item.file_type)}</span>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => onRevealInFolder(item.path)}
                            className="px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-lg flex items-center gap-1.5 transition-colors"
                            title="Abrir no Explorer"
                        >
                            📁 Mostrar na pasta
                        </button>
                        <button
                            type="button"
                            onClick={() => onOpenFile(item.path)}
                            className="px-3.5 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg flex items-center gap-1.5 transition-colors shadow-sm"
                            title="Abrir arquivo no leitor padrão"
                        >
                            ↗ Abrir arquivo
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
