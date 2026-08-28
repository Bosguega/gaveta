import { useEffect, useRef, useState } from 'react';
import { EMBROIDERY_EXTENSIONS } from '@/types';
import { getFileTypeIcon, getFileTypeLabel } from '@/utils/format';

interface FileTypeFilterMenuProps {
    distinctFileTypes: string[];
    distinctEmbroideryExtensions: string[];
    selectedFileType: string;
    onSelectFileType: (type: string) => void;
}

export function FileTypeFilterMenu({
    distinctFileTypes,
    distinctEmbroideryExtensions,
    selectedFileType,
    onSelectFileType,
}: FileTypeFilterMenuProps) {
    const [menuOpen, setMenuOpen] = useState(false);
    const [embroiderySubmenuOpen, setEmbroiderySubmenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setMenuOpen(false);
                setEmbroiderySubmenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectedLabel = (() => {
        if (selectedFileType === 'all') return 'Todos os formatos';
        if (selectedFileType === 'pdf' || selectedFileType === 'image') {
            return `${getFileTypeIcon(selectedFileType)} ${getFileTypeLabel(selectedFileType)}`;
        }
        if (selectedFileType === 'embroidery') {
            return `${getFileTypeIcon('embroidery')} ${getFileTypeLabel('embroidery')}`;
        }
        return `${getFileTypeIcon('embroidery')} .${selectedFileType.toUpperCase()}`;
    })();

    if (distinctFileTypes.length <= 1) {
        return null;
    }

    const selectAndClose = (type: string) => {
        onSelectFileType(type);
        setMenuOpen(false);
        setEmbroiderySubmenuOpen(false);
    };

    return (
        <div className="relative" ref={menuRef}>
            <button
                type="button"
                onClick={() => setMenuOpen((prev) => !prev)}
                className="px-3 py-2 border border-slate-300 rounded-lg bg-white text-sm text-slate-700 flex items-center gap-2"
                title="Filtrar por tipo de arquivo"
            >
                <span>{selectedLabel}</span>
                <span className="text-slate-400 text-xs">▼</span>
            </button>

            {menuOpen && (
                <div className="absolute left-0 top-full mt-1 z-20 w-64 bg-white border border-slate-200 rounded-lg shadow-lg py-1">
                    <button
                        type="button"
                        onClick={() => selectAndClose('all')}
                        className={`w-full text-left px-3 py-1.5 text-sm hover:bg-slate-50 ${
                            selectedFileType === 'all' ? 'bg-blue-50 font-medium text-blue-700' : 'text-slate-700'
                        }`}
                    >
                        📁 Todos os formatos
                    </button>

                    {distinctFileTypes.includes('pdf') && (
                        <button
                            type="button"
                            onClick={() => selectAndClose('pdf')}
                            className={`w-full text-left px-3 py-1.5 text-sm hover:bg-slate-50 ${
                                selectedFileType === 'pdf' ? 'bg-blue-50 font-medium text-blue-700' : 'text-slate-700'
                            }`}
                        >
                            📄 PDF
                        </button>
                    )}

                    {distinctFileTypes.includes('image') && (
                        <button
                            type="button"
                            onClick={() => selectAndClose('image')}
                            className={`w-full text-left px-3 py-1.5 text-sm hover:bg-slate-50 ${
                                selectedFileType === 'image' ? 'bg-blue-50 font-medium text-blue-700' : 'text-slate-700'
                            }`}
                        >
                            🖼️ Imagem
                        </button>
                    )}

                    {distinctFileTypes.includes('embroidery') && (
                        <div
                            className="relative"
                            onMouseEnter={() => setEmbroiderySubmenuOpen(true)}
                            onMouseLeave={() => setEmbroiderySubmenuOpen(false)}
                        >
                            <button
                                type="button"
                                onClick={() => selectAndClose('embroidery')}
                                className={`w-full flex items-center justify-between px-3 py-1.5 text-sm hover:bg-slate-50 ${
                                    selectedFileType === 'embroidery' || EMBROIDERY_EXTENSIONS.includes(selectedFileType)
                                        ? 'bg-blue-50 font-medium text-blue-700'
                                        : 'text-slate-700'
                                }`}
                            >
                                <span>🧵 Bordados</span>
                                <span className="text-slate-400 text-xs">▶</span>
                            </button>

                            {embroiderySubmenuOpen && (
                                <div className="absolute left-full top-0 ml-1 w-48 bg-white border border-slate-200 rounded-lg shadow-lg py-1 max-h-60 overflow-y-auto">
                                    {distinctEmbroideryExtensions.length > 0 ? (
                                        distinctEmbroideryExtensions.map((ext) => (
                                            <button
                                                key={ext}
                                                type="button"
                                                onClick={() => selectAndClose(ext)}
                                                className={`w-full text-left px-3 py-1.5 text-sm uppercase hover:bg-slate-50 ${
                                                    selectedFileType === ext
                                                        ? 'bg-blue-50 font-medium text-blue-700'
                                                        : 'text-slate-700'
                                                }`}
                                            >
                                                .{ext}
                                            </button>
                                        ))
                                    ) : (
                                        <div className="px-3 py-1.5 text-sm text-slate-500">Sem extensões</div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
