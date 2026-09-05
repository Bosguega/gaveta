import { useEffect, useMemo, useState } from 'react';
import { ItemCard } from '@/components/ItemCard';
import { DuplicateAnalysisModal } from '@/components/DuplicateAnalysisModal';
import { ProgressBar } from '@/components/common/ProgressBar';
import { Pagination } from '@/components/common/Pagination';
import { QuickLookModal } from '@/components/common/QuickLookModal';
import { FileTypeFilterMenu } from '@/components/collection/FileTypeFilterMenu';
import { CollectionStatsModal } from '@/components/collection/CollectionStatsModal';
import { useAppStore } from '@/store/useAppStore';
import { getCollection } from '@/services/collections';
import {
    listFavorites,
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
import {
    FAVORITES_COLLECTION_ID,
    type Collection,
    SORT_OPTIONS,
    ITEMS_PER_PAGE_OPTIONS,
    SIZE_FILTER_OPTIONS,
    STITCH_FILTER_OPTIONS,
    EMBROIDERY_EXTENSIONS,
    type CollectionDetail,
    type ScanProgress,
    type SortOption,
    type SizeFilterOption,
    type StitchFilterOption,
} from '@/types';
import { getFileExtension } from '@/utils/format';

function getParentDirectory(filePath: string): string {
    const normalized = filePath.replace(/\\/g, '/');
    const idx = normalized.lastIndexOf('/');
    if (idx <= 0) return 'Raiz';
    return normalized.slice(0, idx);
}

export function CollectionPage() {
    const {
        currentCollectionId,
        focusedItemId,
        setFocusedItemId,
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
        gridDensity,
        setGridDensity,
        viewMode,
        setViewMode,
        favoritesScope,
        collections,
        openCollection,
    } = useAppStore();

    // Favorites virtual collection (id = -1): favorite items across the scoped collections
    const isFavoritesView = currentCollectionId === FAVORITES_COLLECTION_ID;

    const collectionById = useMemo(() => {
        const map = new Map<number, Collection>();
        for (const collection of collections) {
            map.set(collection.id, collection);
        }
        return map;
    }, [collections]);

    const [collectionDetail, setCollectionDetail] = useState<CollectionDetail | null>(null);
    const [search, setSearch] = useState('');
    const [sort, setSort] = useState<SortOption>('name-asc');
    const [selectedFileType, setSelectedFileType] = useState<string>('all');
    const [sizeFilter, setSizeFilter] = useState<SizeFilterOption>('all');
    const [stitchFilter, setStitchFilter] = useState<StitchFilterOption>('all');

    const [unavailableCount, setUnavailableCount] = useState(0);
    const [erroredCount, setErroredCount] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [showDuplicates, setShowDuplicates] = useState(false);
    const [showStats, setShowStats] = useState(false);
    const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
    const [isRegenerating, setIsRegenerating] = useState(false);
    const [regenProgress, setRegenProgress] = useState<ScanProgress | null>(null);
    const [regenSummary, setRegenSummary] = useState<{ regenerated: number; failed: number; failedPaths: string[] } | null>(null);
    const [thumbErrors, setThumbErrors] = useState<string[] | null>(null);
    const [showErrorsOnly, setShowErrorsOnly] = useState(false);
    const [thumbEpoch, setThumbEpoch] = useState(0);
    const [page, setPage] = useState(1);

    // QuickLook State
    const [quickLookIndex, setQuickLookIndex] = useState<number | null>(null);

    const loadItems = async () => {
        if (currentCollectionId === null) return;
        try {
            const data = isFavoritesView ? await listFavorites(favoritesScope) : await listItems(currentCollectionId);
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
            setRegenSummary({ regenerated: result.regenerated, failed: result.failed, failedPaths: result.failed_paths });
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
        setSizeFilter('all');
        setStitchFilter('all');
        setSelectedItems([]);
        setUnavailableCount(0);
        setErroredCount(0);
        setError(null);
        setShowFavoritesOnly(false);
        setShowErrorsOnly(false);
        setThumbErrors(null);
        setShowDuplicates(false);
        setShowStats(false);
        setIsRegenerating(false);
        setRegenProgress(null);
        setRegenSummary(null);
        setQuickLookIndex(null);
        setPage(1);

        if (isFavoritesView) {
            setCollectionDetail(null);
        } else {
            getCollection(currentCollectionId)
                .then((detail) => setCollectionDetail(detail))
                .catch(() => setCollectionDetail(null));
        }

        loadItems();
    }, [currentCollectionId]);

    // Handle focused item from global search
    useEffect(() => {
        if (focusedItemId !== null && items.length > 0) {
            const item = items.find((it) => it.id === focusedItemId);
            if (item) {
                setSelectedItems([focusedItemId]);
            }
            setFocusedItemId(null);
        }
    }, [focusedItemId, items, setSelectedItems, setFocusedItemId]);

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
    }, [search, selectedFileType, sizeFilter, stitchFilter, showFavoritesOnly, showErrorsOnly, clearSelection]);

    // Filter, sort or pagination changes return to page 1
    useEffect(() => {
        setPage(1);
    }, [search, selectedFileType, sizeFilter, stitchFilter, showFavoritesOnly, showErrorsOnly, sort, itemsPerPage]);

    const handleUpdate = async () => {
        if (currentCollectionId === null || isUpdating) return;
        setIsUpdating(true);
        setError(null);
        setUpdateProgress({ stage: 'Iniciando...', current: 0, total: 0 });
        try {
            const result = await updateCollectionScan(currentCollectionId);
            setUnavailableCount(result.unavailable_paths.length);
            setErroredCount(result.errored_paths.length);
            setThumbErrors(result.thumbnail_failed_paths.length > 0 ? result.thumbnail_failed_paths : null);
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

        if (showErrorsOnly) {
            result = result.filter((item) => item.thumbnail_status === 'error');
        }

        // File type filter
        if (selectedFileType === 'embroidery') {
            result = result.filter((item) => item.file_type === 'embroidery');
        } else if (selectedFileType === 'pdf' || selectedFileType === 'image') {
            result = result.filter((item) => item.file_type === selectedFileType);
        } else if (selectedFileType !== 'all') {
            result = result.filter((item) => getFileExtension(item.filename) === selectedFileType);
        }

        // Size filter
        if (sizeFilter === 'lt-2mb') {
            result = result.filter((item) => item.size < 2 * 1024 * 1024);
        } else if (sizeFilter === '2mb-10mb') {
            result = result.filter((item) => item.size >= 2 * 1024 * 1024 && item.size <= 10 * 1024 * 1024);
        } else if (sizeFilter === '10mb-50mb') {
            result = result.filter((item) => item.size > 10 * 1024 * 1024 && item.size <= 50 * 1024 * 1024);
        } else if (sizeFilter === 'gt-50mb') {
            result = result.filter((item) => item.size > 50 * 1024 * 1024);
        }

        // Stitch count filter (embroidery only)
        if (stitchFilter === 'lt-10k') {
            result = result.filter((item) => item.stitch_count !== null && item.stitch_count < 10000);
        } else if (stitchFilter === '10k-30k') {
            result = result.filter((item) => item.stitch_count !== null && item.stitch_count >= 10000 && item.stitch_count <= 30000);
        } else if (stitchFilter === 'gt-30k') {
            result = result.filter((item) => item.stitch_count !== null && item.stitch_count > 30000);
        }

        // Search filter
        if (query) {
            result = result.filter((item) => item.filename.toLowerCase().includes(query) || item.path.toLowerCase().includes(query));
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
    }, [items, search, sort, showFavoritesOnly, showErrorsOnly, selectedFileType, sizeFilter, stitchFilter]);

    const totalItems = filteredAndSorted.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
    const currentPage = Math.min(page, totalPages);
    const pageItems = useMemo(
        () => filteredAndSorted.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage),
        [filteredAndSorted, currentPage, itemsPerPage],
    );

    // Grouping by folder
    const groupedItems = useMemo(() => {
        if (viewMode !== 'folder') return null;
        const groups: Record<string, typeof pageItems> = {};
        for (const item of pageItems) {
            const parent = getParentDirectory(item.path);
            if (!groups[parent]) {
                groups[parent] = [];
            }
            groups[parent].push(item);
        }
        return groups;
    }, [pageItems, viewMode]);

    // Spacebar shortcut for Quick Look
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === ' ' && quickLookIndex === null) {
                const targetTag = (e.target as HTMLElement)?.tagName?.toLowerCase();
                if (['input', 'textarea', 'select'].includes(targetTag)) return;

                e.preventDefault();
                if (selectedIds.length > 0) {
                    const foundIndex = pageItems.findIndex((it) => it.id === selectedIds[0]);
                    if (foundIndex >= 0) {
                        setQuickLookIndex(foundIndex);
                        return;
                    }
                }
                if (pageItems.length > 0) {
                    setQuickLookIndex(0);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [quickLookIndex, selectedIds, pageItems]);

    // Grid density CSS classes
    const gridColsClass =
        gridDensity === 'compact'
            ? 'grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-3'
            : gridDensity === 'large'
            ? 'grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-6'
            : 'grid-cols-[repeat(auto-fill,minmax(165px,1fr))] gap-4';

    const hasEmbroidery = distinctFileTypes.includes('embroidery');

    return (
        <div className="p-8 max-w-[1600px] mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                    <button
                        onClick={closeCollection}
                        className="text-slate-600 hover:text-slate-900 font-medium px-2 py-1 rounded hover:bg-slate-200/60 transition-colors"
                        title="Voltar"
                    >
                        ← Voltar
                    </button>
                    {isFavoritesView ? (
                        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            <span>★ Favoritos</span>
                            <span className="text-xs font-normal text-slate-400">({items.length} itens)</span>
                        </h1>
                    ) : (
                        collectionDetail?.name && (
                            <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                <span>{collectionDetail.name}</span>
                                <span className="text-xs font-normal text-slate-400">({items.length} itens)</span>
                            </h1>
                        )
                    )}
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                    {unavailableCount > 0 && (
                        <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                            ⚠ {unavailableCount} local(is) indisponível(is)
                        </span>
                    )}
                    {erroredCount > 0 && (
                        <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200" title="Pastas com erro de leitura foram preservadas para não apagar itens ou favoritos">
                            ⚠ {erroredCount} local(is) preservados
                        </span>
                    )}

                    {!isFavoritesView && (
                    <button
                        type="button"
                        onClick={() => setShowStats(true)}
                        disabled={items.length === 0}
                        className="px-3 py-1.5 text-sm bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium disabled:opacity-40"
                        title="Ver estatísticas e resumo da coleção"
                    >
                        📊 Estatísticas
                    </button>
                    )}

                    {isFavoritesView ? (
                        <button
                            onClick={() => setShowDuplicates(true)}
                            disabled={items.length === 0}
                            className="px-3.5 py-1.5 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-40 font-medium shadow-sm"
                            title="Analisar duplicados entre os favoritos"
                        >
                            🔍 Duplicados
                        </button>
                    ) : isUpdating ? (
                        <button
                            onClick={handleCancel}
                            className="px-4 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium shadow-sm"
                        >
                            Cancelar
                        </button>
                    ) : (
                        <>
                            <button
                                onClick={() => setShowDuplicates(true)}
                                disabled={items.length === 0}
                                className="px-3.5 py-1.5 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-40 font-medium shadow-sm"
                                title={items.length === 0 ? 'Atualize a coleção primeiro' : 'Analisar duplicados nesta coleção'}
                            >
                                🔍 Duplicados
                            </button>
                            <button
                                onClick={handleUpdate}
                                className="px-3.5 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-sm"
                            >
                                🔄 Atualizar
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Filter, search and display controls bar */}
            <div className="flex flex-wrap items-center gap-3 mb-6 bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
                {/* Search input */}
                <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="🔎 Buscar arquivos..."
                    className="flex-1 min-w-[200px] px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
                />

                {/* File Type Filter */}
                <FileTypeFilterMenu
                    distinctFileTypes={distinctFileTypes}
                    distinctEmbroideryExtensions={distinctEmbroideryExtensions}
                    selectedFileType={selectedFileType}
                    onSelectFileType={setSelectedFileType}
                />

                {/* Size Filter */}
                <select
                    value={sizeFilter}
                    onChange={(e) => setSizeFilter(e.target.value as SizeFilterOption)}
                    className="px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-sm text-slate-700"
                    title="Filtrar por tamanho"
                >
                    {SIZE_FILTER_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>

                {/* Stitch count Filter (only if collection has embroidery) */}
                {hasEmbroidery && (
                    <select
                        value={stitchFilter}
                        onChange={(e) => setStitchFilter(e.target.value as StitchFilterOption)}
                        className="px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-sm text-slate-700"
                        title="Filtrar por quantidade de pontos de bordado"
                    >
                        {STITCH_FILTER_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                )}

                {/* Favorites button */}
                {!isFavoritesView && <button
                    onClick={() => setShowFavoritesOnly((prev) => !prev)}
                    className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
                        showFavoritesOnly
                            ? 'bg-amber-400 border-amber-400 text-white'
                            : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'
                    }`}
                    title={showFavoritesOnly ? 'Mostrar todos os arquivos' : 'Mostrar apenas favoritos'}
                >
                    ★ {showFavoritesOnly ? 'Favoritos' : 'Todos'}
                </button>}

                {/* Thumbnail errors filter */}
                {!isFavoritesView && <button
                    onClick={() => setShowErrorsOnly((prev) => !prev)}
                    className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
                        showErrorsOnly
                            ? 'bg-red-500 border-red-500 text-white'
                            : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'
                    }`}
                    title="Mostrar apenas arquivos com erro de miniatura (inválidos ou corrompidos)"
                >
                    ⚠ Com erro
                </button>}

                {/* Sort selector */}
                <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value as SortOption)}
                    className="px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-sm text-slate-700"
                    title="Critério de ordenação"
                >
                    {SORT_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>

                {/* Items per page selector */}
                <select
                    value={itemsPerPage}
                    onChange={(e) => setItemsPerPage(Number(e.target.value))}
                    className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-sm text-slate-700"
                    title="Itens por página"
                >
                    {ITEMS_PER_PAGE_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                            {option} / pág
                        </option>
                    ))}
                </select>

                {/* Divider */}
                <div className="h-6 w-px bg-slate-200 hidden sm:block" />

                {/* View Mode (Flat vs Folder) */}
                <div className="flex items-center rounded-lg border border-slate-300 bg-slate-100 p-0.5">
                    <button
                        type="button"
                        onClick={() => setViewMode('flat')}
                        className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                            viewMode === 'flat' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                        }`}
                        title="Visualização em Grade Contínua"
                    >
                        ▦ Grade
                    </button>
                    <button
                        type="button"
                        onClick={() => setViewMode('folder')}
                        className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                            viewMode === 'folder' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                        }`}
                        title="Agrupar por Subpastas"
                    >
                        📁 Pastas
                    </button>
                </div>

                {/* Grid Density Switcher */}
                <div className="flex items-center rounded-lg border border-slate-300 bg-slate-100 p-0.5" title="Tamanho das miniaturas">
                    <button
                        type="button"
                        onClick={() => setGridDensity('compact')}
                        className={`px-2 py-1 text-xs font-medium rounded-md transition-colors ${
                            gridDensity === 'compact' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                        }`}
                        title="Miniaturas pequenas"
                    >
                        S
                    </button>
                    <button
                        type="button"
                        onClick={() => setGridDensity('normal')}
                        className={`px-2 py-1 text-xs font-medium rounded-md transition-colors ${
                            gridDensity === 'normal' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                        }`}
                        title="Miniaturas normais"
                    >
                        M
                    </button>
                    <button
                        type="button"
                        onClick={() => setGridDensity('large')}
                        className={`px-2 py-1 text-xs font-medium rounded-md transition-colors ${
                            gridDensity === 'large' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                        }`}
                        title="Miniaturas grandes com detalhes"
                    >
                        L
                    </button>
                </div>
            </div>

            {/* Batch actions bar */}
            <div className="mb-6 flex flex-wrap items-center gap-2">
                <button
                    onClick={() => setSelectedItems(filteredAndSorted.map((item) => item.id))}
                    disabled={filteredAndSorted.length === 0 || isRegenerating}
                    className="px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                    title="Selecionar todos os itens exibidos pelo filtro atual"
                >
                    Selecionar todos
                </button>
                <button
                    onClick={clearSelection}
                    disabled={selectedIds.length === 0 || isRegenerating}
                    className="px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                >
                    Limpar seleção
                </button>
                <span className="text-xs text-slate-500">
                    {selectedIds.length} selecionado{selectedIds.length === 1 ? '' : 's'}
                </span>

                {selectedIds.length > 0 && (
                    <button
                        onClick={() => {
                            const foundIndex = pageItems.findIndex((it) => it.id === selectedIds[0]);
                            setQuickLookIndex(foundIndex >= 0 ? foundIndex : 0);
                        }}
                        className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-1"
                        title="Pré-visualizar item selecionado (Espaço)"
                    >
                        🔍 Pré-visualizar (Espaço)
                    </button>
                )}

                {!isFavoritesView && (
                <button
                    onClick={handleRegenerateThumbnails}
                    disabled={selectedIds.length === 0 || isRegenerating}
                    className="ml-auto px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 disabled:opacity-40 shadow-xs"
                    title="Gerar novamente as miniaturas dos itens selecionados"
                >
                    {isRegenerating
                        ? 'Gerando...'
                        : `🔄 Regenerar miniaturas${selectedIds.length > 0 ? ` (${selectedIds.length})` : ''}`}
                </button>
                )}
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
                    {regenSummary.failedPaths.length > 0 && (
                        <ul className="mt-1.5 list-disc list-inside text-xs text-red-700 max-h-32 overflow-y-auto">
                            {regenSummary.failedPaths.map((path) => (
                                <li key={path} className="truncate" title={path}>
                                    {path}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}

            {thumbErrors && thumbErrors.length > 0 && (
                <div className="mb-6 rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
                    <p className="font-medium">
                        ⚠ {thumbErrors.length} arquivo(s) com miniatura não gerada — provavelmente inválidos ou corrompidos:
                    </p>
                    <ul className="mt-1.5 list-disc list-inside text-xs text-amber-700 max-h-32 overflow-y-auto">
                        {thumbErrors.map((path) => (
                            <li key={path} className="truncate" title={path}>
                                {path}
                            </li>
                        ))}
                    </ul>
                    <p className="text-xs text-amber-600 mt-1.5">
                        Use o filtro "⚠ Com erro" abaixo para localizá-los na grade.
                    </p>
                </div>
            )}

            {/* Content items grid or empty state */}
            {filteredAndSorted.length === 0 ? (
                <div className="text-center py-20 text-slate-500 bg-white rounded-2xl border border-dashed border-slate-300">
                    <div className="text-5xl mb-4">📄</div>
                    <p className="text-lg font-semibold text-slate-700">
                        {items.length === 0 ? 'Nenhum arquivo encontrado' : 'Nenhum resultado para os filtros atuais'}
                    </p>
                    {items.length === 0 && (
                        <p className="text-sm mt-1">Clique em "Atualizar" para escanear as pastas configuradas</p>
                    )}
                </div>
            ) : viewMode === 'folder' && groupedItems ? (
                /* Grouped by Folder View */
                <div className="space-y-8">
                    {Object.entries(groupedItems).map(([folderPath, groupItems]) => (
                        <div key={folderPath} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                            <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
                                <span className="text-base">📁</span>
                                <h3 className="text-sm font-bold text-slate-800 truncate" title={folderPath}>
                                    {folderPath}
                                </h3>
                                <span className="text-xs text-slate-400 ml-auto font-medium">
                                    {groupItems.length} arquivo(s)
                                </span>
                            </div>
                            <div className={`grid ${gridColsClass}`}>
                                {groupItems.map((item) => (
                                    <ItemCard
                                        key={item.id}
                                        item={item}
                                        selected={selectedItemIds.has(item.id)}
                                        refreshKey={thumbEpoch}
                                        onSelect={() => toggleItemSelection(item.id)}
                                        onOpen={() => handleOpenFile(item.path)}
                                        onQuickLook={() => {
                                            const idx = pageItems.findIndex((it) => it.id === item.id);
                                            setQuickLookIndex(idx >= 0 ? idx : 0);
                                        }}
                                        onRevealInFolder={() => handleRevealInFolder(item.path)}
                                        onToggleFavorite={() => handleToggleFavorite(item.id)}
                                        collectionName={isFavoritesView ? collectionById.get(item.collection_id)?.name : undefined}
                                        collectionIcon={isFavoritesView ? collectionById.get(item.collection_id)?.icon : undefined}
                                        onGoToCollection={isFavoritesView ? () => openCollection(item.collection_id) : undefined}
                                    />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                /* Flat Grid View */
                <div className={`grid ${gridColsClass}`}>
                    {pageItems.map((item, index) => (
                        <ItemCard
                            key={item.id}
                            item={item}
                            selected={selectedItemIds.has(item.id)}
                            refreshKey={thumbEpoch}
                            onSelect={() => toggleItemSelection(item.id)}
                            onOpen={() => handleOpenFile(item.path)}
                            onQuickLook={() => setQuickLookIndex(index)}
                            onRevealInFolder={() => handleRevealInFolder(item.path)}
                            onToggleFavorite={() => handleToggleFavorite(item.id)}
                            collectionName={isFavoritesView ? collectionById.get(item.collection_id)?.name : undefined}
                            collectionIcon={isFavoritesView ? collectionById.get(item.collection_id)?.icon : undefined}
                            onGoToCollection={isFavoritesView ? () => openCollection(item.collection_id) : undefined}
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

            {/* Quick Look Fullscreen Preview Modal */}
            {quickLookIndex !== null && pageItems.length > 0 && (
                <QuickLookModal
                    items={pageItems}
                    currentIndex={quickLookIndex}
                    onClose={() => setQuickLookIndex(null)}
                    onNavigate={(index) => setQuickLookIndex(index)}
                    onOpenFile={handleOpenFile}
                    onRevealInFolder={handleRevealInFolder}
                    onToggleFavorite={handleToggleFavorite}
                    refreshKey={thumbEpoch}
                />
            )}

            {/* Collection Stats Modal */}
            {showStats && collectionDetail && (
                <CollectionStatsModal
                    collectionName={collectionDetail.name}
                    items={items}
                    pathsCount={collectionDetail.paths.length}
                    onClose={() => setShowStats(false)}
                />
            )}

            {/* Duplicates Modal */}
            {showDuplicates && currentCollectionId !== null && (
                <DuplicateAnalysisModal
                    collectionIds={isFavoritesView ? favoritesScope : [currentCollectionId]}
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
