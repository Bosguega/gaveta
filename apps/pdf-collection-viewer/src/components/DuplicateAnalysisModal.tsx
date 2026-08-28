import { useEffect, useMemo, useState } from 'react';
import type { DuplicateAnalysis, DuplicateGroup, DuplicateItem, RemoveDuplicateResult, ScanProgress } from '@/types';
import { analyzeDuplicates, listenToAnalyzeProgress, openFile, removeDuplicate, revealInFolder } from '@/services/items';
import { formatBytes, formatModifiedAt } from '@/utils/format';
import { ItemThumbnail } from '@/components/common/ItemThumbnail';
import { ProgressBar } from '@/components/common/ProgressBar';

interface Props {
    collectionId: number;
    onClose: () => void;
    onChanged: () => void;
}

interface ItemState {
    keep: boolean;
    remove: boolean;
    busy: boolean;
    error: string | null;
}

type ItemStateMap = Record<number, ItemState>;

function createInitialState(groups: DuplicateGroup[]): ItemStateMap {
    const state: ItemStateMap = {};
    for (const group of groups) {
        // Backend already sorts: shortest path first, then alphabetical.
        // First item is the default "keep".
        group.items.forEach((item, index) => {
            state[item.item_id] = {
                keep: index === 0,
                remove: index !== 0,
                busy: false,
                error: null,
            };
        });
    }
    return state;
}


export function DuplicateAnalysisModal({ collectionId, onClose, onChanged }: Props) {
    const [analysis, setAnalysis] = useState<DuplicateAnalysis | null>(null);
    const [loading, setLoading] = useState(true);
    const [progress, setProgress] = useState<ScanProgress | null>(null);
    const [itemState, setItemState] = useState<ItemStateMap>({});
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);

    const runAnalysis = async () => {
        setLoading(true);
        setError(null);
        setNotice(null);
        setProgress({ stage: 'Iniciando...', current: 0, total: 0 });
        try {
            const result = await analyzeDuplicates(collectionId);
            setAnalysis(result);
            setItemState(createInitialState(result.groups));
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : 'Não foi possível analisar duplicados.');
        } finally {
            setLoading(false);
            setProgress(null);
        }
    };

    useEffect(() => {
        const unlisten = listenToAnalyzeProgress((p) => setProgress(p));
        runAnalysis();
        return unlisten;
    }, [collectionId]);

    const totalDuplicates = useMemo(() => {
        if (!analysis) return 0;
        return analysis.groups.reduce((sum, group) => sum + group.items.length - 1, 0);
    }, [analysis]);

    const selectedToRemove = useMemo(() => {
        return Object.entries(itemState)
            .filter(([, state]) => state.remove && !state.busy && !state.error)
            .map(([id]) => Number(id));
    }, [itemState]);

    const findItem = (itemId: number): DuplicateItem | undefined => {
        if (!analysis) return undefined;
        for (const group of analysis.groups) {
            const found = group.items.find((item) => item.item_id === itemId);
            if (found) return found;
        }
        return undefined;
    };

    const remainingGroups = useMemo(() => {
        if (!analysis) return [];
        return analysis.groups
            .map((group) => ({
                ...group,
                items: group.items.filter((item) => itemState[item.item_id] !== undefined),
            }))
            .filter((group) => group.items.length >= 2);
    }, [analysis, itemState]);

    const handleKeepChange = (groupId: string, keepId: number) => {
        if (!analysis) return;
        const group = analysis.groups.find((g) => g.hash === groupId);
        if (!group) return;

        setItemState((prev) => {
            const next = { ...prev };
            for (const item of group.items) {
                next[item.item_id] = {
                    ...next[item.item_id],
                    keep: item.item_id === keepId,
                    remove: item.item_id !== keepId,
                };
            }
            return next;
        });
    };

    const handleToggleRemove = (itemId: number) => {
        setItemState((prev) => ({
            ...prev,
            [itemId]: {
                ...prev[itemId],
                remove: !prev[itemId].remove,
            },
        }));
    };

    const handleOpen = async (path: string) => {
        try {
            await openFile(path);
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : 'Não foi possível abrir o arquivo.');
        }
    };

    const handleReveal = async (path: string) => {
        try {
            await revealInFolder(path);
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : 'Não foi possível abrir a pasta.');
        }
    };

    const applyResult = (itemId: number, result: RemoveDuplicateResult) => {
        setItemState((prev) => {
            const next = { ...prev };
            delete next[itemId];
            return next;
        });

        if (result.file_missing) {
            setNotice('Um ou mais arquivos não existiam mais no computador. Os registros foram atualizados.');
        }
        if (result.affected_other_collections > 0) {
            setNotice(
                `Arquivo removido também de ${result.affected_other_collections} outra(s) coleção(ões).`,
            );
        }
    };

    const handleRemoveFromCollection = async () => {
        if (selectedToRemove.length === 0 || busy) return;
        setBusy(true);
        setError(null);
        setNotice(null);

        try {
            for (const itemId of selectedToRemove) {
                setItemState((prev) => ({
                    ...prev,
                    [itemId]: { ...prev[itemId], busy: true, error: null },
                }));
                try {
                    const result = await removeDuplicate(collectionId, itemId, false);
                    applyResult(itemId, result);
                } catch (reason) {
                    setItemState((prev) => ({
                        ...prev,
                        [itemId]: {
                            ...prev[itemId],
                            busy: false,
                            error: reason instanceof Error ? reason.message : 'Falha ao remover.',
                        },
                    }));
                }
            }
            onChanged();
        } finally {
            setBusy(false);
        }
    };

    const handleRemoveFromDisk = async () => {
        if (selectedToRemove.length === 0 || busy) return;
        const confirmed = window.confirm(
            `Isso enviará ${selectedToRemove.length} arquivo(s) para a Lixeira do sistema. O arquivo será removido de todas as coleções.`,
        );
        if (!confirmed) return;

        setBusy(true);
        setError(null);
        setNotice(null);

        try {
            for (const itemId of selectedToRemove) {
                const item = findItem(itemId);
                setItemState((prev) => ({
                    ...prev,
                    [itemId]: { ...prev[itemId], busy: true, error: null },
                }));
                try {
                    const result = await removeDuplicate(collectionId, itemId, true, item?.hash);
                    applyResult(itemId, result);
                } catch (reason) {
                    const message = reason instanceof Error ? reason.message : 'Falha ao remover.';
                    setItemState((prev) => ({
                        ...prev,
                        [itemId]: {
                            ...prev[itemId],
                            busy: false,
                            error: message,
                        },
                    }));
                }
            }
            onChanged();
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[85vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
                    <div>
                        <h2 className="text-lg font-semibold text-slate-800">🔍 Duplicados nesta coleção</h2>
                        {analysis && !loading && (
                            <p className="text-sm text-slate-500 mt-0.5">
                                {analysis.groups.length} grupo(s) · {totalDuplicates} arquivo(s) duplicado(s)
                                {analysis.unreadable_count > 0 && ` · ${analysis.unreadable_count} não analisado(s)`}
                            </p>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="text-slate-500 hover:text-slate-800 text-xl leading-none"
                        title="Fechar"
                    >
                        ×
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-6 py-4">
                    {loading && (
                        <div className="py-12 text-center">
                            {progress && (
                                <ProgressBar progress={progress} className="max-w-md mx-auto mb-4" />
                            )}
                            <div className="text-slate-500">Analisando arquivos...</div>
                        </div>
                    )}

                    {!loading && error && (
                        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
                    )}

                    {!loading && notice && (
                        <div className="mb-4 rounded-lg bg-blue-50 p-3 text-sm text-blue-700">{notice}</div>
                    )}

                    {!loading && !error && remainingGroups.length === 0 && (
                        <div className="py-12 text-center text-slate-500">
                            <div className="text-5xl mb-4">✅</div>
                            <p className="text-lg">Nenhum duplicado encontrado nesta coleção</p>
                        </div>
                    )}

                    {!loading && remainingGroups.map((group, groupIndex) => (
                        <div key={group.hash} className="mb-6">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-sm font-medium text-slate-700">
                                    Grupo {groupIndex + 1}
                                </span>
                                <span className="text-xs text-slate-400">
                                    {group.items.length} cópias · {formatBytes(group.size)} cada
                                </span>
                            </div>

                            <div className="space-y-2">
                                {group.items.map((item) => {
                                    const state = itemState[item.item_id];
                                    if (!state) return null;
                                    return (
                                        <div
                                            key={item.item_id}
                                            className={`flex items-center gap-3 p-3 rounded-lg border ${state.keep
                                                ? 'border-green-300 bg-green-50'
                                                : state.remove
                                                    ? 'border-slate-200 bg-white'
                                                    : 'border-slate-200 bg-slate-50 opacity-60'
                                                }`}
                                        >
                                            <input
                                                type="radio"
                                                name={`keep-${group.hash}`}
                                                checked={state.keep}
                                                onChange={() => handleKeepChange(group.hash, item.item_id)}
                                                title="Manter este arquivo"
                                                className="accent-green-600"
                                            />
                                            <ItemThumbnail item={item} size="sm" />
                                            <div className="flex-1 min-w-0">

                                                <div className="text-sm font-medium text-slate-800 truncate" title={item.filename}>
                                                    {item.filename}
                                                </div>
                                                <div className="text-xs text-slate-500 truncate" title={item.path}>
                                                    {item.path}
                                                </div>
                                                <div className="text-xs text-slate-400 mt-0.5">
                                                    {formatBytes(item.size)} · {formatModifiedAt(item.modified_at)}
                                                </div>
                                                {state.error && (
                                                    <div className="text-xs text-red-600 mt-1">{state.error}</div>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-1 shrink-0">
                                                <button
                                                    onClick={() => handleOpen(item.path)}
                                                    className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded"
                                                    title="Abrir arquivo"
                                                >
                                                    Abrir
                                                </button>
                                                <button
                                                    onClick={() => handleReveal(item.path)}
                                                    className="px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 rounded"
                                                    title="Mostrar na pasta"
                                                >
                                                    📁
                                                </button>
                                                {!state.keep && (
                                                    <label className="flex items-center gap-1 text-xs text-slate-600 cursor-pointer ml-2">
                                                        <input
                                                            type="checkbox"
                                                            checked={state.remove}
                                                            disabled={state.busy}
                                                            onChange={() => handleToggleRemove(item.item_id)}
                                                            className="accent-red-600"
                                                        />
                                                        Remover
                                                    </label>
                                                )}
                                                {state.keep && (
                                                    <span className="ml-2 text-xs font-medium text-green-700">
                                                        Manter
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer */}
                {!loading && remainingGroups.length > 0 && (
                    <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-slate-200">
                        <span className="text-sm text-slate-500">
                            {selectedToRemove.length} selecionado(s) para remoção
                        </span>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleRemoveFromCollection}
                                disabled={selectedToRemove.length === 0 || busy}
                                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                Remover da coleção ({selectedToRemove.length})
                            </button>
                            <button
                                onClick={handleRemoveFromDisk}
                                disabled={selectedToRemove.length === 0 || busy}
                                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                Mover para a Lixeira ({selectedToRemove.length})
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
