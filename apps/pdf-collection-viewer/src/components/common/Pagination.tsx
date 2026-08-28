import { useState } from 'react';

interface PaginationProps {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
    onPageChange: (page: number) => void;
}

/**
 * Builds the pagination page list: first and last pages, the pages around the
 * current one, and `…` placeholders for the gaps in between.
 */
function getPageNumbers(currentPage: number, totalPages: number): (number | '…')[] {
    if (totalPages <= 7) {
        return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const wanted = new Set<number>([1, totalPages, currentPage - 1, currentPage, currentPage + 1]);
    const pages: (number | '…')[] = [];
    let previous = 0;
    for (let candidate = 1; candidate <= totalPages; candidate++) {
        if (!wanted.has(candidate)) continue;
        if (previous > 0 && candidate - previous > 1) {
            pages.push('…');
        }
        pages.push(candidate);
        previous = candidate;
    }
    return pages;
}

export function Pagination({
    currentPage,
    totalPages,
    totalItems,
    itemsPerPage,
    onPageChange,
}: PaginationProps) {
    const [pageInput, setPageInput] = useState('');

    if (totalPages <= 1) {
        return null;
    }

    const rangeStart = totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
    const rangeEnd = Math.min(currentPage * itemsPerPage, totalItems);

    const handleGoToPage = (e: React.FormEvent) => {
        e.preventDefault();
        const parsed = Number.parseInt(pageInput, 10);
        if (!Number.isNaN(parsed)) {
            onPageChange(Math.min(totalPages, Math.max(1, parsed)));
        }
        setPageInput('');
    };

    return (
        <div className="mt-6 flex flex-col items-center gap-3">
            <div className="flex flex-wrap items-center justify-center gap-1">
                <button
                    onClick={() => onPageChange(1)}
                    disabled={currentPage === 1}
                    className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Primeira página"
                >
                    «
                </button>
                <button
                    onClick={() => onPageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    ‹ Anterior
                </button>
                {getPageNumbers(currentPage, totalPages).map((entry, index) =>
                    entry === '…' ? (
                        <span key={`ellipsis-${index}`} className="px-1 text-sm text-slate-400">
                            …
                        </span>
                    ) : (
                        <button
                            key={entry}
                            onClick={() => onPageChange(entry)}
                            className={`px-3 py-1.5 rounded-lg text-sm border ${
                                entry === currentPage
                                    ? 'bg-blue-600 border-blue-600 text-white'
                                    : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                            }`}
                        >
                            {entry}
                        </button>
                    ),
                )}
                <button
                    onClick={() => onPageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    Próxima ›
                </button>
                <button
                    onClick={() => onPageChange(totalPages)}
                    disabled={currentPage === totalPages}
                    className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Última página"
                >
                    »
                </button>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 text-sm text-slate-500">
                <span>
                    Página {currentPage} de {totalPages} · mostrando {rangeStart}–{rangeEnd} de {totalItems}
                </span>
                <form onSubmit={handleGoToPage} className="flex items-center gap-2">
                    <label htmlFor="go-to-page" className="text-slate-500">
                        Ir para a página
                    </label>
                    <input
                        id="go-to-page"
                        type="number"
                        min={1}
                        max={totalPages}
                        value={pageInput}
                        onChange={(event) => setPageInput(event.target.value)}
                        className="w-20 px-2 py-1 border border-slate-300 rounded-lg text-sm text-slate-700"
                    />
                    <button
                        type="submit"
                        className="px-3 py-1 border border-slate-300 rounded-lg bg-white text-sm text-slate-700 hover:bg-slate-50"
                    >
                        Ir
                    </button>
                </form>
            </div>
        </div>
    );
}
