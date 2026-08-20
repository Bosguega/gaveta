import { useEffect, useMemo, useState } from 'react';
import { ItemCard } from '@/components/ItemCard';
import { DuplicateAnalysisModal } from '@/components/DuplicateAnalysisModal';
import { useAppStore } from '@/store/useAppStore';
import { getCollection } from '@/services/collections';
import { listItems, updateCollectionScan, openFile, listenToUpdateProgress, cancelScan, toggleFavorite } from '@/services/items';
import { clearThumbnailUrlCache } from '@/services/thumbnails';
import { SORT_OPTIONS, type SortOption } from '@/types';

export function CollectionPage() {
    const { currentCollectionId, closeCollection, items, setItems, isUpdating, setIsUpdating, updateProgress, setUpdateProgress } = useAppStore();
    const [collectionName, setCollectionName] = useState('');
    const [search, setSearch] = useState('');
    const [sort, setSort] = useState<SortOption>('name-asc');
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [unavailableCount, setUnavailableCount] = useState(0);
    const [erroredCount, setErroredCount] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [showDuplicates, setShowDuplicates] = useState(false);
    const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

    const loadItems = async () => {
        if (currentCollectionId === null) return;
        try {
            const data = await listItems(currentCollectionId);
            setItems(data);
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : 'Não foi possível carregar os arquivos.');
        }
    };

    useEffect(() => {
        if (currentCollectionId === null) return;

        setSearch('');
        setSort('name-asc');
        setSelectedId(null);
        setUnavailableCount(0);
        setErroredCount(0);
        setError(null);
        setShowFavoritesOnly(false);
        setShowDuplicates(false);

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

    const filteredAndSorted = useMemo(() => {
        const query = search.trim().toLowerCase();
        let result = items;

        if (showFavoritesOnly) {
            result = result.filter((item) => item.is_favorite);
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
                sorted.sort((a, b) => a.size - b.size);
                break;
            case 'size-desc':
                sorted.sort((a, b) => b.size - a.size);
                break;
            case 'modified-desc':
                sorted.sort((a, b) => {
                    const aTime = parseInt(a.modified_at, 10) || 0;
                    const bTime = parseInt(b.modified_at, 10) || 0;
                    return bTime - aTime;
                });
                break;
            case 'modified-asc':
                sorted.sort((a, b) => {
                    const aTime = parseInt(a.modified_at, 10) || 0;
                    const bTime = parseInt(b.modified_at, 10) || 0;
                    return aTime - bTime;
                });
                break;
            case 'pages-asc':
                sorted.sort((a, b) => (a.page_count ?? 0) - (b.page_count ?? 0));
                break;
            case 'pages-desc':
                sorted.sort((a, b) => (b.page_count ?? 0) - (a.page_count ?? 0));
                break;
        }
        return sorted;
    }, [items, search, sort, showFavoritesOnly]);

    return (
        <div className="p-8">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <button
                        onClick={closeCollection}
                        className="text-slate-600 hover:text-slate-900"
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
                            className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700"
                        >
                            Cancelar
                        </button>
                    ) : (
                        <>
                            <button
                                onClick={() => setShowDuplicates(true)}
                                disabled={items.length === 0}
                                className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed"
                                title={items.length === 0 ? 'Atualize a coleção primeiro' : 'Analisar duplicados nesta coleção'}
                            >
                                🔍 Analisar duplicados
                            </button>
                            <button
                                onClick={handleUpdate}
                                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                            >
                                🔄 Atualizar
                            </button>
                        </>
                    )}
                </div>
            </div>

            <div className="flex items-center gap-3 mb-6">
                <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="🔎 Buscar arquivos..."
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                    onClick={() => setShowFavoritesOnly((prev) => !prev)}
                    className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${showFavoritesOnly
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
                    className="px-3 py-2 border border-slate-300 rounded-lg bg-white"
                >
                    {SORT_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
            </div>
            {error && <div className="mb-6 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}

            {isUpdating && updateProgress && (
                <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                    <div className="text-sm text-blue-800 mb-2">
                        {updateProgress.stage}: {updateProgress.current} / {updateProgress.total}
                    </div>
                    <div className="h-2 bg-blue-200 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-blue-600 transition-all"
                            style={{
                                width: updateProgress.total > 0
                                    ? `${(updateProgress.current / updateProgress.total) * 100}%`
                                    : '0%',
                            }}
                        />
                    </div>
                </div>
            )}

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
                    {filteredAndSorted.map((item) => (
                        <ItemCard
                            key={item.id}
                            item={item}
                            selected={selectedId === item.id}
                            onSelect={() => setSelectedId(item.id)}
                            onOpen={() => handleOpenFile(item.path)}
                            onToggleFavorite={() => handleToggleFavorite(item.id)}
                        />
                    ))}
                </div>
            )}

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
