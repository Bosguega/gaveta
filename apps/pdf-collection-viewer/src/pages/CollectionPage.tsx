import { useEffect, useMemo, useState } from 'react';
import { ItemCard } from '@/components/ItemCard';
import { DuplicateAnalysisModal } from '@/components/DuplicateAnalysisModal';
import { ProgressBar } from '@/components/common/ProgressBar';
import { Pagination } from '@/components/common/Pagination';
import { FileTypeFilterMenu } from '@/components/collection/FileTypeFilterMenu';
import { useAppStore } from '@/store/useAppStore';
import { getCollection } from '@/services/collections';
import {
    listItems,
    updateCollectionScan,
    openFile,
    listenToUpdateProgress,
    cancelScan,
    toggleFavorite,
    revealInFolder,
    regenerateThumbnails,
    listenToRegenerateProgress,
} from '@/services/items';
import { clearThumbnailUrlCache } from '@/services/thumbnails';
import { SORT_OPTIONS, ITEMS_PER_PAGE_OPTIONS, EMBROIDERY_EXTENSIONS, type ScanProgress, type SortOption } from '@/types';
import { getFileExtension } from '@/utils/format';

export function CollectionPage() {
    const {
        currentCollectionId,
        closeCollection,
        items,
        setItems,
        isUpdating,
        setIsUpdating,
        updateProgress,
        setUpdateProgress,
        selectedItemIds,
        toggleItemSelection,
        setSelectedItems,
        clearSelection,
        itemsPerPage,
        setItemsPerPage,
    } = useAppStore();

    const [collectionName, setCollectionName] = useState('');
    const [search, setSearch] = useState('');
    const [sort, setSort] = useState<SortOption>('name-asc');
    const [selectedFileType, setSelectedFileType] = useState<string>('all');
    const [unavailableCount, setUnavailableCount] = useState(0);
    const [erroredCount, setErroredCount] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [showDuplicates, setShowDuplicates] = useState(false);
    const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
    const [isRegenerating, setIsRegenerating] = useState(false);
    const [regenProgress, setRegenProgress] = useState<ScanProgress | null>(null);
    const [regenSummary, setRegenSummary] = useState<{ regenerated: number; failed: number } | null>(null);
    const [thumbEpoch, setThumbEpoch] = useState(0);
    const [page, setPage] = useState(1);

    const loadItems = async () => {
        if (currentCollectionId === null) return;
        try {
            const data = await listItems(currentCollectionId);
            setItems(data);
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : 'Não foi possível carregar os arquivos.');
        }
    };

    const selectedIds = useMemo(() => Array.from(selectedItemIds), [selectedItemIds]);

    const handleRegenerateThumbnails = async () => {
        if (currentCollectionId === null || isRegenerating || selectedIds.length === 0) return;
        setIsRegenerating(true);
        setError(null);
        setRegenSummary(null);
        setRegenProgress({ stage: 'Iniciando...', current: 0, total: selectedIds.length });
        try {
            const result = await regenerateThumbnails(currentCollectionId, selectedIds);
            setRegenSummary({ regenerated: result.regenerated, failed: result.failed });
            clearThumbnailUrlCache();
            setThumbEpoch((epoch) => epoch + 1);
            await loadItems();
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : 'Não foi possível gerar as miniaturas.');
        } finally {
            setIsRegenerating(false);
            setRegenProgress(null);
        }
    };

    useEffect(() => {
        if (currentCollectionId === null) return;

        setSearch('');
        setSort('name-asc');
        setSelectedFileType('all');
        setSelectedItems([]);
        setUnavailableCount(0);
        setErroredCount(0);
        setError(null);
        setShowFavoritesOnly(false);
        setShowDuplicates(false);
        setIsRegenerating(false);
        setRegenProgress(null);
        setRegenSummary(null);
        setPage(1);

        getCollection(currentCollectionId)
            .then((detail) => setCollectionName(detail?.name ?? ''))
            .catch(() => setCollectionName(''));

        loadItems();
    }, [currentCollectionId]);

    useEffect(() => {
        const unlisten = listenToUpdateProgress((progress) => {
            setUpdateProgress(progress);
        });
        return unlisten;
    }, []);

    useEffect(() => {
        const unlisten = listenToRegenerateProgress((progress) => {
            setRegenProgress(progress);
        });
        return unlisten;
    }, []);

    // Drop selection when any filter changes to prevent hidden items from staying selected
    useEffect(() => {
        clearSelection();
    }, [search, selectedFileType, showFavoritesOnly, clearSelection]);

    // Filter, sort or pagination changes return to page 1
    useEffect(() => {
        setPage(1);
    }, [search, selectedFileType, showFavoritesOnly, sort, itemsPerPage]);

    const handleUpdate = async () => {
        if (currentCollectionId === null || isUpdating) return;
        setIsUpdating(true);
        setError(null);
        setUpdateProgress({ stage: 'Iniciando...', current: 0, total: 0 });
        try {
            const result = await updateCollectionScan(currentCollectionId);
            setUnavailableCount(result.unavailable_paths.length);
            setErroredCount(result.errored_paths.length);
            clearThumbnailUrlCache();
            await loadItems();
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : 'Não foi possível atualizar a coleção.');
        } finally {
            setIsUpdating(false);
            setUpdateProgress(null);
        }
    };

    const handleCancel = async () => {
        await cancelScan(currentCollectionId ?? undefined);
    };

    const handleOpenFile = async (path: string) => {
        try {
            await openFile(path);
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : 'Não foi possível abrir o arquivo.');
        }
    };

    const handleToggleFavorite = async (itemId: number) => {
        try {
            const newState = await toggleFavorite(itemId);
            setItems(items.map((item) => (item.id === itemId ? { ...item, is_favorite: newState } : item)));
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : 'Não foi possível alterar o favorito.');
        }
    };

    const handleRevealInFolder = async (path: string) => {
        try {
            await revealInFolder(path);
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : 'Não foi possível localizar o arquivo.');
        }
    };

    const distinctFileTypes = useMemo(() => {
        const types = new Set<string>();
        for (const item of items) {
            if (item.file_type) {
                types.add(item.file_type);
            }
        }
        return Array.from(types);
    }, [items]);

    const distinctEmbroideryExtensions = useMemo(() => {
        const set = new Set<string>();
        for (const item of items) {
            if (item.file_type === 'embroidery') {
                const ext = getFileExtension(item.filename);
                if (ext && EMBROIDERY_EXTENSIONS.includes(ext)) {
                    set.add(ext);
                }
            }
        }
        return Array.from(set).sort();
    }, [items]);

    const filteredAndSorted = useMemo(() => {
        const query = search.trim().toLowerCase();
        let result = items;

        if (showFavoritesOnly) {
            result = result.filter((item) => item.is_favorite);
        }

        if (selectedFileType === 'embroidery') {
            result = result.filter((item) => item.file_type === 'embroidery');
        } else if (selectedFileType === 'pdf' || selectedFileType === 'image') {
            result = result.filter((item) => item.file_type === selectedFileType);
        } else if (selectedFileType !== 'all') {
            result = result.filter((item) => getFileExtension(item.filename) === selectedFileType);
        }

        if (query) {
            result = result.filter((item) => item.filename.toLowerCase().includes(query));
        }

        const sorted = [...result];
        switch (sort) {
            case 'name-asc':
                sorted.sort((a, b) => a.filename.localeCompare(b.filename, 'pt-BR'));
                break;
            case 'name-desc':
                sorted.sort((a, b) => b.filename.localeCompare(a.filename, 'pt-BR'));
                break;
            case 'size-asc':
                sorted.sort((a, b) => a.size - b.size || a.filename.localeCompare(b.filename, 'pt-BR'));
                break;
            case 'size-desc':
                sorted.sort((a, b) => b.size - a.size || a.filename.localeCompare(b.filename, 'pt-BR'));
                break;
            case 'modified-desc':
                sorted.sort((a, b) => {
                    const aTime = parseInt(a.modified_at, 10) || 0;
                    const bTime = parseInt(b.modified_at, 10) || 0;
                    return bTime - aTime || a.filename.localeCompare(b.filename, 'pt-BR');
                });
                break;
            case 'modified-asc':
                sorted.sort((a, b) => {
                    const aTime = parseInt(a.modified_at, 10) || 0;
                    const bTime = parseInt(b.modified_at, 10) || 0;
                    return aTime - bTime || a.filename.localeCompare(b.filename, 'pt-BR');
                });
                break;
            case 'pages-asc':
                sorted.sort((a, b) => {
                    if (a.page_count === null && b.page_count === null) {
                        return a.filename.localeCompare(b.filename, 'pt-BR');
                    }
                    if (a.page_count === null) return 1;
                    if (b.page_count === null) return -1;
                    return a.page_count - b.page_count || a.filename.localeCompare(b.filename, 'pt-BR');
                });
                break;
            case 'pages-desc':
                sorted.sort((a, b) => {
                    if (a.page_count === null && b.page_count === null) {
                        return a.filename.localeCompare(b.filename, 'pt-BR');
                    }
                    if (a.page_count === null) return 1;
                    if (b.page_count === null) return -1;
                    return b.page_count - a.page_count || a.filename.localeCompare(b.filename, 'pt-BR');
                });
                break;
        }
        return sorted;
    }, [items, search, sort, showFavoritesOnly, selectedFileType]);

    const totalItems = filteredAndSorted.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
    const currentPage = Math.min(page, totalPages);
    const pageItems = useMemo(
        () => filteredAndSorted.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage),
        [filteredAndSorted, currentPage, itemsPerPage],
    );

    return (
        <div className="p-8">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <button
                        onClick={closeCollection}
                        className="text-slate-600 hover:text-slate-900 font-medium"
                        title="Voltar"
                    >
                        ← Voltar
                    </button>
                    {collectionName && (
                        <h1 className="text-xl font-semibold text-slate-800">{collectionName}</h1>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    {unavailableCount > 0 && (
                        <span className="text-sm text-amber-600">
                            ⚠ {unavailableCount} local(is) indisponível(is)
                        </span>
                    )}
                    {erroredCount > 0 && (
                        <span className="text-sm text-amber-600" title="Pastas com erro de leitura foram preservadas para não apagar itens ou favoritos">
                            ⚠ {erroredCount} local(is) com erro de leitura (itens preservados)
                        </span>
                    )}
                    {isUpdating ? (
                        <button
                            onClick={handleCancel}
                            className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
                        >
                            Cancelar
                        </button>
                    ) : (
                        <>
                            <button
                                onClick={() => setShowDuplicates(true)}
                                disabled={items.length === 0}
                                className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed font-medium"
                                title={items.length === 0 ? 'Atualize a coleção primeiro' : 'Analisar duplicados nesta coleção'}
                            >
                                🔍 Analisar duplicados
                            </button>
                            <button
                                onClick={handleUpdate}
                                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                            >
                                🔄 Atualizar
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Filter and search bar */}
            <div className="flex items-center gap-3 mb-6">
                <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="🔎 Buscar arquivos..."
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />

                <FileTypeFilterMenu
                    distinctFileTypes={distinctFileTypes}
                    distinctEmbroideryExtensions={distinctEmbroideryExtensions}
                    selectedFileType={selectedFileType}
                    onSelectFileType={setSelectedFileType}
                />

                <button
                    onClick={() => setShowFavoritesOnly((prev) => !prev)}
                    className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                        showFavoritesOnly
                            ? 'bg-amber-400 border-amber-400 text-white'
                            : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'
                    }`}
                    title={showFavoritesOnly ? 'Mostrar todos os arquivos' : 'Mostrar apenas favoritos'}
                >
                    ★ {showFavoritesOnly ? 'Favoritos' : 'Todos'}
                </button>

                <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value as SortOption)}
                    className="px-3 py-2 border border-slate-300 rounded-lg bg-white text-sm text-slate-700"
                >
                    {SORT_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>

                <select
                    value={itemsPerPage}
                    onChange={(e) => setItemsPerPage(Number(e.target.value))}
                    className="px-3 py-2 border border-slate-300 rounded-lg bg-white text-sm text-slate-700"
                    title="Itens por página"
                >
                    {ITEMS_PER_PAGE_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                            {option} / página
                        </option>
                    ))}
                </select>
            </div>

            {/* Batch actions bar */}
            <div className="mb-6 flex flex-wrap items-center gap-2">
                <button
                    onClick={() => setSelectedItems(filteredAndSorted.map((item) => item.id))}
                    disabled={filteredAndSorted.length === 0 || isRegenerating}
                    className="px-3 py-2 border border-slate-300 rounded-lg bg-white text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Selecionar todos os itens exibidos pelo filtro atual"
                >
                    Selecionar todos
                </button>
                <button
                    onClick={clearSelection}
                    disabled={selectedIds.length === 0 || isRegenerating}
                    className="px-3 py-2 border border-slate-300 rounded-lg bg-white text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    Limpar seleção
                </button>
                <span className="text-sm text-slate-500">
                    {selectedIds.length} selecionado{selectedIds.length === 1 ? '' : 's'}
                </span>
                <button
                    onClick={handleRegenerateThumbnails}
                    disabled={selectedIds.length === 0 || isRegenerating}
                    className="ml-auto px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Gerar novamente as miniaturas dos itens selecionados"
                >
                    {isRegenerating
                        ? 'Gerando...'
                        : `🔄 Gerar as miniaturas novamente${selectedIds.length > 0 ? ` (${selectedIds.length})` : ''}`}
                </button>
            </div>

            {error && <div className="mb-6 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}

            {isUpdating && updateProgress && (
                <ProgressBar progress={updateProgress} className="mb-6" />
            )}

            {isRegenerating && regenProgress && (
                <ProgressBar progress={regenProgress} className="mb-6" />
            )}

            {regenSummary && (
                <div className="mb-6 rounded-lg bg-green-50 p-3 text-sm text-green-800">
                    Miniaturas regeneradas: {regenSummary.regenerated} concluída(s)
                    {regenSummary.failed > 0
                        ? `, ${regenSummary.failed} com erro (miniaturas antigas mantidas)`
                        : ''}.
                </div>
            )}

            {/* Content items grid or empty state */}
            {filteredAndSorted.length === 0 ? (
                <div className="text-center py-16 text-slate-500">
                    <div className="text-5xl mb-4">📄</div>
                    <p className="text-lg">
                        {items.length === 0 ? 'Nenhum arquivo encontrado' : 'Nenhum resultado para a busca'}
                    </p>
                    {items.length === 0 && (
                        <p className="text-sm mt-1">Clique em "Atualizar" para escanear as pastas</p>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-4">
                    {pageItems.map((item) => (
                        <ItemCard
                            key={item.id}
                            item={item}
                            selected={selectedItemIds.has(item.id)}
                            refreshKey={thumbEpoch}
                            onSelect={() => toggleItemSelection(item.id)}
                            onOpen={() => handleOpenFile(item.path)}
                            onRevealInFolder={() => handleRevealInFolder(item.path)}
                            onToggleFavorite={() => handleToggleFavorite(item.id)}
                        />
                    ))}
                </div>
            )}

            {/* Pagination Component */}
            <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalItems}
                itemsPerPage={itemsPerPage}
                onPageChange={setPage}
            />

            {/* Duplicates modal */}
            {showDuplicates && currentCollectionId !== null && (
                <DuplicateAnalysisModal
                    collectionId={currentCollectionId}
                    onClose={() => setShowDuplicates(false)}
                    onChanged={() => {
                        clearThumbnailUrlCache();
                        loadItems();
                    }}
                />
            )}
        </div>
    );
}
