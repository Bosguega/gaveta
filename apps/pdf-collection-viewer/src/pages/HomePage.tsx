import { useEffect, useState } from 'react';
import { CollectionCard } from '@/components/CollectionCard';
import { CollectionForm } from '@/components/CollectionForm';
import { ItemThumbnail } from '@/components/common/ItemThumbnail';
import { useAppStore } from '@/store/useAppStore';
import {
    listCollections,
    createCollection,
    updateCollection,
    deleteCollection,
    getCollection,
    toggleCollectionPin,
} from '@/services/collections';
import { DuplicateAnalysisModal } from '@/components/DuplicateAnalysisModal';
import { searchAllItems } from '@/services/items';
import type { CollectionDetail, GlobalSearchResultItem } from '@/types';
import { FAVORITES_COLLECTION_ID } from '@/types';
import { formatBytes, getFileTypeLabel } from '@/utils/format';


export function HomePage() {
    const { collections, setCollections, openCollection, currentCollectionId, setFavoritesScope } = useAppStore();
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState<CollectionDetail | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<{ id: number; name: string } | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Global cross-collection search
    const [globalSearch, setGlobalSearch] = useState('');
    const [searchResults, setSearchResults] = useState<GlobalSearchResultItem[]>([]);
    const [searching, setSearching] = useState(false);

    // Scope: collection ids filter (null = all collections) shared by global search,
    // favorites virtual collection and duplicates analysis
    const [scope, setScope] = useState<number[] | null>(null);
    const [scopeMenuOpen, setScopeMenuOpen] = useState(false);
    const [showDuplicates, setShowDuplicates] = useState(false);

    const loadCollections = async () => {
        try {
            const data = await listCollections();
            setCollections(data);
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : 'Não foi possível carregar as coleções.');
        }
    };

    useEffect(() => {
        if (currentCollectionId === null) {
            loadCollections();
        }
    }, [currentCollectionId]);

    // Handle global search debounce
    useEffect(() => {
        const query = globalSearch.trim();
        if (!query) {
            setSearchResults([]);
            setSearching(false);
            return;
        }

        setSearching(true);
        const timer = setTimeout(() => {
            searchAllItems(query, 50, scope)
                .then((res) => {
                    setSearchResults(res);
                })
                .catch(() => {
                    setSearchResults([]);
                })
                .finally(() => {
                    setSearching(false);
                });
        }, 200);

        return () => clearTimeout(timer);
    }, [globalSearch, scope]);

    const handleCreate = async (data: {
        name: string;
        icon: string;
        iconPath: string | null;
        paths: string[];
        includeSubfolders: boolean;
    }) => {
        await createCollection(data.name, data.icon, data.iconPath, data.paths, data.includeSubfolders);
        setShowForm(false);
        await loadCollections();
    };

    const handleUpdate = async (data: {
        name: string;
        icon: string;
        iconPath: string | null;
        paths: string[];
        includeSubfolders: boolean;
    }) => {
        if (!editing) return;
        await updateCollection(editing.id, data.name, data.icon, data.iconPath, data.paths, data.includeSubfolders);
        setEditing(null);
        await loadCollections();
    };

    const handleEdit = async (id: number) => {
        try {
            const detail = await getCollection(id);
            if (detail) {
                setEditing(detail);
            } else {
                setError('Coleção não encontrada.');
            }
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : 'Não foi possível carregar a coleção.');
        }
    };

    const handleDelete = async () => {
        if (!confirmDelete) return;
        try {
            await deleteCollection(confirmDelete.id);
            setConfirmDelete(null);
            await loadCollections();
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : 'Não foi possível excluir a coleção.');
        }
    };

    const handleTogglePin = async (id: number) => {
        try {
            await toggleCollectionPin(id);
            await loadCollections();
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : 'Não foi possível fixar/desafixar a coleção.');
        }
    };

    const pinnedCollections = collections.filter((c) => c.is_pinned);
    const regularCollections = collections.filter((c) => !c.is_pinned);

    return (
        <div className="p-8 max-w-7xl mx-auto">
            {/* Header & Global Search */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Minhas coleções</h1>
                    <p className="text-xs text-slate-500 mt-0.5">
                        {collections.length} coleção(ões) catalogada(s)
                    </p>
                </div>

                <div className="flex items-center gap-3 flex-1 max-w-lg">
                    <div className="relative flex-1">
                        <input
                            type="text"
                            value={globalSearch}
                            onChange={(e) => setGlobalSearch(e.target.value)}
                            placeholder="🔎 Buscar arquivos em todas as coleções..."
                            className="w-full pl-9 pr-8 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        />
                        <span className="absolute left-3 top-2.5 text-slate-400 text-sm pointer-events-none">
                            🔍
                        </span>
                        {globalSearch && (
                            <button
                                type="button"
                                onClick={() => setGlobalSearch('')}
                                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 text-xs w-4 h-4 rounded-full flex items-center justify-center bg-slate-100"
                            >
                                ✕
                            </button>
                        )}
                    </div>

                    {/* Collection scope selector */}
                    <div className="relative shrink-0">
                        <button
                            type="button"
                            onClick={() => setScopeMenuOpen((prev) => !prev)}
                            className="px-3 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 bg-white hover:bg-slate-50"
                            title="Escolher em quais coleções buscar (favoritos, duplicados e busca global)"
                        >
                            {scope === null ? ' Todas as coleções ▾' : `${scope.length} coleção(ões) ▾`}
                        </button>
                        {scopeMenuOpen && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setScopeMenuOpen(false)} />
                                <div className="absolute right-0 top-full mt-1 w-64 max-h-72 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg z-50 p-2">
                                    <label className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-lg hover:bg-slate-50 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={scope === null}
                                            onChange={() => {
                                                setScope(null);
                                                setScopeMenuOpen(false);
                                            }}
                                            className="accent-blue-600"
                                        />
                                        <span className="font-medium">Todas as coleções</span>
                                    </label>
                                    {collections.map((collection) => {
                                        const checked = scope !== null && scope.includes(collection.id);
                                        return (
                                            <label
                                                key={collection.id}
                                                className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-lg hover:bg-slate-50 cursor-pointer"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    onChange={() => {
                                                        setScope((prev) => {
                                                            const base = prev ?? collections.map((col) => col.id);
                                                            if (base.includes(collection.id)) {
                                                                const next = base.filter((id) => id !== collection.id);
                                                                return next.length === 0 ? null : next;
                                                            }
                                                            return [...base, collection.id];
                                                        });
                                                    }}
                                                    className="accent-blue-600"
                                                />
                                                <span className="truncate">
                                                    {collection.icon} {collection.name}
                                                </span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </>
                        )}
                    </div>

                    {/* Favorites virtual collection */}
                    <button
                        type="button"
                        onClick={() => {
                            setFavoritesScope(scope);
                            openCollection(FAVORITES_COLLECTION_ID);
                        }}
                        disabled={collections.length === 0}
                        className="px-3 py-2 bg-amber-400 text-white text-sm font-medium rounded-lg hover:bg-amber-500 shrink-0 shadow-sm disabled:opacity-40"
                        title="Abrir os favoritos das coleções no escopo selecionado"
                    >
                        ★ Favoritos
                    </button>

                    {/* Global duplicates analysis */}
                    <button
                        type="button"
                        onClick={() => setShowDuplicates(true)}
                        disabled={collections.length === 0}
                        className="px-3 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 shrink-0 shadow-sm disabled:opacity-40"
                        title="Buscar arquivos duplicados no escopo selecionado"
                    >
                        🔍 Duplicados
                    </button>

                    <button
                        onClick={() => setShowForm(true)}
                        className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 shrink-0 shadow-sm"
                    >
                        + Nova Coleção
                    </button>
                </div>
            </div>

            {error && <div className="mb-6 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}

            {/* Global Search Results view */}
            {globalSearch.trim().length > 0 && (
                <div className="mb-10 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
                            <span>🔍 Resultados da busca global para</span>
                            <span className="text-blue-600 font-bold">"{globalSearch.trim()}"</span>
                        </h2>
                        <span className="text-xs text-slate-500">
                            {searching ? 'Pesquisando...' : `${searchResults.length} arquivo(s) encontrado(s)`}
                        </span>
                    </div>

                    {searchResults.length === 0 && !searching ? (
                        <div className="py-12 text-center text-slate-400">
                            <p className="text-base">Nenhum arquivo encontrado com esse nome ou caminho.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-[60vh] overflow-y-auto pr-1">
                            {searchResults.map((item) => (
                                <div
                                    key={`${item.collection_id}-${item.id}`}
                                    onClick={() => openCollection(item.collection_id, item.id)}
                                    className="flex items-center gap-3 p-3 bg-slate-50 hover:bg-blue-50/50 border border-slate-200 hover:border-blue-300 rounded-xl cursor-pointer transition-all group"
                                    title={`Abrir na coleção "${item.collection_name}"`}
                                >
                                    <ItemThumbnail item={item} size="sm" />
                                    <div className="flex-1 min-w-0">
                                        <div className="text-xs font-semibold text-slate-800 group-hover:text-blue-700 truncate" title={item.filename}>
                                            {item.filename}
                                        </div>
                                        <div className="text-[11px] text-slate-500 truncate mt-0.5" title={item.path}>
                                            {formatBytes(item.size)} · {getFileTypeLabel(item.file_type)}
                                        </div>
                                        <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded text-[10px] font-medium bg-blue-100/70 text-blue-800 truncate">
                                            📁 {item.collection_name}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Empty state when no collections exist */}
            {collections.length === 0 && !showForm ? (
                <div className="text-center py-20 text-slate-500 bg-white rounded-2xl border border-dashed border-slate-300">
                    <div className="text-6xl mb-4">📚</div>
                    <p className="text-xl font-semibold text-slate-700">Nenhuma coleção ainda</p>
                    <p className="text-sm mt-1 text-slate-500 mb-6">
                        Crie sua primeira coleção de pastas para visualizar e organizar seus arquivos.
                    </p>
                    <button
                        onClick={() => setShowForm(true)}
                        className="px-5 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 shadow-sm"
                    >
                        Criar primeira coleção
                    </button>
                </div>
            ) : (
                <div className="space-y-8">
                    {/* Pinned collections section */}
                    {pinnedCollections.length > 0 && (
                        <div>
                            <div className="flex items-center gap-2 mb-4">
                                <span className="text-sm font-semibold text-slate-700 uppercase tracking-wider">
                                    📌 Fixadas
                                </span>
                                <span className="text-xs text-slate-400">({pinnedCollections.length})</span>
                            </div>
                            <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-5">
                                {pinnedCollections.map((collection) => (
                                    <CollectionCard
                                        key={collection.id}
                                        collection={collection}
                                        onOpen={() => openCollection(collection.id)}
                                        onEdit={() => handleEdit(collection.id)}
                                        onDelete={() => setConfirmDelete({ id: collection.id, name: collection.name })}
                                        onTogglePin={() => handleTogglePin(collection.id)}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Regular collections section */}
                    <div>
                        {pinnedCollections.length > 0 && (
                            <div className="flex items-center gap-2 mb-4">
                                <span className="text-sm font-semibold text-slate-700 uppercase tracking-wider">
                                    📚 Todas as coleções
                                </span>
                                <span className="text-xs text-slate-400">({regularCollections.length})</span>
                            </div>
                        )}
                        <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-5">
                            {regularCollections.map((collection) => (
                                <CollectionCard
                                    key={collection.id}
                                    collection={collection}
                                    onOpen={() => openCollection(collection.id)}
                                    onEdit={() => handleEdit(collection.id)}
                                    onDelete={() => setConfirmDelete({ id: collection.id, name: collection.name })}
                                    onTogglePin={() => handleTogglePin(collection.id)}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Collection form modal */}
            {(showForm || editing) && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6 backdrop-blur-xs">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200">
                        <h2 className="text-lg font-semibold mb-4 text-slate-800">
                            {editing ? 'Editar coleção' : 'Nova coleção'}
                        </h2>
                        <CollectionForm
                            initialName={editing?.name}
                            initialIconPath={editing?.icon_path}
                            initialPaths={editing?.paths}
                            initialIncludeSubfolders={editing?.include_subfolders}
                            onSubmit={editing ? handleUpdate : handleCreate}
                            onCancel={() => {
                                setShowForm(false);
                                setEditing(null);
                            }}
                        />
                    </div>
                </div>
            )}

            {/* Confirm delete modal */}
            {confirmDelete && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6 backdrop-blur-xs">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-slate-200">
                        <h2 className="text-lg font-semibold mb-2 text-slate-800">
                            Remover a coleção "{confirmDelete.name}"?
                        </h2>
                        <p className="text-sm text-slate-600 mb-6">
                            Isso não apagará nenhum arquivo do computador, apenas removerá o registro da coleção.
                        </p>
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => setConfirmDelete(null)}
                                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleDelete}
                                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium shadow-sm"
                            >
                                Excluir
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Global duplicates analysis modal */}
            {showDuplicates && (
                <DuplicateAnalysisModal
                    collectionIds={scope}
                    scopeLabel={scope === null ? 'todas as coleções' : `${scope.length} coleção(ões)`}
                    onClose={() => setShowDuplicates(false)}
                    onChanged={() => {
                        loadCollections();
                    }}
                />
            )}
        </div>
    );
}
