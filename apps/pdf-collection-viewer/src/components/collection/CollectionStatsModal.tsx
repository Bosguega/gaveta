import { useMemo } from 'react';
import type { CollectionItem } from '@/types';
import { formatBytes } from '@/utils/format';

interface CollectionStatsModalProps {
    collectionName: string;
    items: CollectionItem[];
    pathsCount: number;
    onClose: () => void;
}

export function CollectionStatsModal({
    collectionName,
    items,
    pathsCount,
    onClose,
}: CollectionStatsModalProps) {
    const stats = useMemo(() => {
        let totalBytes = 0;
        let favoritesCount = 0;
        const byType: Record<string, { count: number; bytes: number }> = {};

        for (const item of items) {
            totalBytes += item.size;
            if (item.is_favorite) {
                favoritesCount++;
            }
            const type = item.file_type || 'outro';
            if (!byType[type]) {
                byType[type] = { count: 0, bytes: 0 };
            }
            byType[type].count++;
            byType[type].bytes += item.size;
        }

        const erroredThumbnails = items.filter((item) => item.thumbnail_status === 'error').length;

        return {
            totalItems: items.length,
            totalBytes,
            favoritesCount,
            erroredThumbnails,
            byType,
        };
    }, [items]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6 backdrop-blur-xs">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
                    <div>
                        <h2 className="text-lg font-semibold text-slate-800">📊 Estatísticas da coleção</h2>
                        <p className="text-xs text-slate-500 mt-0.5">{collectionName}</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-700 text-xl leading-none p-1"
                        title="Fechar"
                    >
                        ×
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-6">
                    {/* Primary summary cards */}
                    <div className="grid grid-cols-4 gap-3">
                        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3.5 text-center">
                            <span className="text-xs font-medium text-blue-600 uppercase tracking-wide">Total de Itens</span>
                            <div className="text-2xl font-bold text-blue-900 mt-1">{stats.totalItems.toLocaleString('pt-BR')}</div>
                            <span className="text-xs text-blue-500 mt-0.5 block">{pathsCount} pasta(s)</span>
                        </div>

                        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3.5 text-center">
                            <span className="text-xs font-medium text-indigo-600 uppercase tracking-wide">Volume Total</span>
                            <div className="text-2xl font-bold text-indigo-900 mt-1">{formatBytes(stats.totalBytes)}</div>
                            <span className="text-xs text-indigo-500 mt-0.5 block">em disco</span>
                        </div>

                        <div className="bg-amber-50 border border-amber-100 rounded-xl p-3.5 text-center">
                            <span className="text-xs font-medium text-amber-600 uppercase tracking-wide">Favoritos</span>
                            <div className="text-2xl font-bold text-amber-900 mt-1">★ {stats.favoritesCount}</div>
                            <span className="text-xs text-amber-600 mt-0.5 block">
                                {stats.totalItems > 0 ? Math.round((stats.favoritesCount / stats.totalItems) * 100) : 0}% da coleção
                            </span>
                        </div>

                        <div className="bg-red-50 border border-red-100 rounded-xl p-3.5 text-center">
                            <span className="text-xs font-medium text-red-600 uppercase tracking-wide">Inválidos</span>
                            <div className="text-2xl font-bold text-red-900 mt-1">⚠ {stats.erroredThumbnails}</div>
                            <span className="text-xs text-red-600 mt-0.5 block">miniatura não gerada</span>
                        </div>
                    </div>

                    {/* Breakdown by file type */}
                    <div>
                        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                            Distribuição por Formato
                        </h3>
                        <div className="space-y-2.5">
                            {Object.entries(stats.byType).map(([type, data]) => {
                                const percent = stats.totalItems > 0 ? Math.round((data.count / stats.totalItems) * 100) : 0;
                                const label = type === 'pdf' ? 'Documentos PDF' : type === 'embroidery' ? 'Matrizes de Bordado' : type === 'image' ? 'Imagens' : type.toUpperCase();
                                const icon = type === 'pdf' ? '📄' : type === 'embroidery' ? '🧵' : type === 'image' ? '🖼️' : '📁';

                                return (
                                    <div key={type} className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                                        <div className="flex items-center justify-between text-sm mb-1.5">
                                            <span className="font-medium text-slate-700 flex items-center gap-1.5">
                                                <span>{icon}</span>
                                                <span>{label}</span>
                                            </span>
                                            <span className="text-xs text-slate-500">
                                                <strong>{data.count}</strong> ({percent}%) · {formatBytes(data.bytes)}
                                            </span>
                                        </div>
                                        <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                            <div className="h-full bg-blue-600 rounded-full" style={{ width: `${percent}%` }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-sm bg-slate-800 text-white rounded-lg hover:bg-slate-700 font-medium"
                    >
                        Fechar
                    </button>
                </div>
            </div>
        </div>
    );
}
