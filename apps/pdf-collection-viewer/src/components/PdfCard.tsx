import { useEffect, useState } from 'react';
import type { Pdf } from '@/types';
import { formatBytes, formatPageCount } from '@/utils/format';
import { getThumbnailUrl } from '@/services/thumbnails';

interface Props {
    pdf: Pdf;
    selected: boolean;
    onSelect: () => void;
    onOpen: () => void;
    onToggleFavorite: () => void;
}

export function PdfCard({ pdf, selected, onSelect, onOpen, onToggleFavorite }: Props) {
    const [imgSrc, setImgSrc] = useState<string>('');

    useEffect(() => {
        let active = true;
        if (pdf.thumbnail_status === 'ready' && pdf.thumbnail_key) {
            getThumbnailUrl(pdf.thumbnail_key)
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
        }
        return () => {
            active = false;
        };
    }, [pdf.thumbnail_key, pdf.thumbnail_status]);

    const showPlaceholder = !imgSrc || pdf.thumbnail_status !== 'ready';

    return (
        <div
            className={`group relative bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow cursor-pointer overflow-hidden ${selected ? 'ring-2 ring-blue-500' : ''}`}
            onClick={onSelect}
            onDoubleClick={onOpen}
            title={pdf.path}
        >
            <div className="aspect-[3/4] bg-slate-100 flex items-center justify-center overflow-hidden">
                {!showPlaceholder ? (
                    <img
                        src={imgSrc}
                        alt={pdf.filename}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        onError={() => setImgSrc('')}
                    />
                ) : (
                    <div className="flex flex-col items-center justify-center text-slate-400">
                        <span className="text-4xl mb-2">📄</span>
                        <span className="text-xs">
                            {pdf.thumbnail_status === 'error' ? 'Miniatura indisponível' : 'Sem miniatura'}
                        </span>
                    </div>
                )}

                <button
                    type="button"
                    onClick={(event) => {
                        event.stopPropagation();
                        onToggleFavorite();
                    }}
                    onDoubleClick={(event) => event.stopPropagation()}
                    className={`absolute top-2 left-2 w-8 h-8 rounded-full flex items-center justify-center text-lg shadow-sm backdrop-blur-sm transition-colors ${pdf.is_favorite
                            ? 'bg-amber-400/90 hover:bg-amber-500 text-white'
                            : 'bg-white/80 hover:bg-white text-slate-400 hover:text-amber-500 opacity-0 group-hover:opacity-100'
                        }`}
                    title={pdf.is_favorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
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
                    title="Abrir PDF"
                >
                    Abrir ↗
                </button>
            </div>

            <div className="p-3">
                <div className="font-medium text-sm text-slate-800 truncate" title={pdf.filename}>
                    {pdf.filename}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                    {formatBytes(pdf.size)} · {formatPageCount(pdf.page_count)}
                </div>
            </div>
        </div>
    );
}
