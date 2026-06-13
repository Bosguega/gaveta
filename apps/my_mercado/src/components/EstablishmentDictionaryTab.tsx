import { useEffect, useMemo, useState, useRef } from "react";
import { Book, Plus, RotateCcw, Save, X, Edit3, Trash2 } from "lucide-react";
import { toast, type Toast } from "react-hot-toast";
import { notify } from "../utils/notifications";
import { logger } from "../utils/logger";
import UniversalSearchBar from "./UniversalSearchBar";
import ConfirmDialog from "./ConfirmDialog";
import { Skeleton } from "./Skeleton";
import { filterBySearch, sortItems } from "../utils/filters";
import type { ConfirmDialogConfig, SortDirection } from "../types/ui";
import type { EstablishmentDictionaryEntry } from "../types/domain";
import { useAllReceiptsQuery } from "../hooks/queries/useReceiptsQuery";
import { useEstablishmentPrefillStore } from "../stores/useEstablishmentPrefillStore";
import {
    useApplyEstablishmentEntryToSavedReceipts,
    useClearEstablishmentDictionary,
    useDeleteEstablishmentDictionaryEntry,
    useEstablishmentDictionaryQuery,
    useUpsertEstablishmentDictionaryEntry,
} from "../hooks/queries/useEstablishmentDictionaryQuery";

function EstablishmentDictionaryTab() {
    const PAGE_SIZE = 100;
    const { refetch: refetchReceipts } = useAllReceiptsQuery();
    const { data: dictionary = [], isLoading: loading } = useEstablishmentDictionaryQuery();
    const upsertEntry = useUpsertEstablishmentDictionaryEntry();
    const deleteEntry = useDeleteEstablishmentDictionaryEntry();
    const clearDictionary = useClearEstablishmentDictionary();
    const applyChanges = useApplyEstablishmentEntryToSavedReceipts();
    const prefillNomeNota = useEstablishmentPrefillStore((s) => s.nomeNota);
    const clearPrefill = useEstablishmentPrefillStore((s) => s.clear);
    const prefillApplied = useRef(false);

    const [searchQuery, setSearchQuery] = useState("");
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
    const [sortBy, setSortBy] = useState("recent");
    const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
    const [editingKey, setEditingKey] = useState<string | null>(null);
    const [isAdding, setIsAdding] = useState(false);
    const [addForm, setAddForm] = useState({
        nome_nota: "",
        nome_fantasia: "",
    });
    const [editForm, setEditForm] = useState({
        nome_fantasia: "",
    });
    const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogConfig | null>(null);
    const [confirmBusy, setConfirmBusy] = useState(false);

    const closeConfirm = () => {
        confirmDialog?.onCancel?.();
        setConfirmDialog(null);
        setConfirmBusy(false);
    };

    const runConfirm = async () => {
        if (!confirmDialog) return;
        setConfirmBusy(true);
        try {
            await confirmDialog.onConfirm();
            setConfirmDialog(null);
        } finally {
            setConfirmBusy(false);
        }
    };

    const applyChangesToSavedReceipts = async (
        oldName: string,
        newName: string,
    ) => {
        const toastId = notify.loading("Atualizando notas salvas...");
        try {
            const { updatedCount } = await applyChanges.mutateAsync({
                oldName,
                newName,
            });

            refetchReceipts();

            if (!updatedCount) {
                notify.dismiss(toastId);
                notify.success("Nenhuma nota salva precisou ser atualizada.");
            } else {
                notify.dismiss(toastId);
                notify.success(`Atualizado em ${updatedCount} nota(s) salva(s).`);
            }
        } catch (err) {
            logger.error("EstablishmentDictionaryTab", "Erro ao aplicar correcao nas notas", err);
            notify.dismiss(toastId);
            notify.error("Erro ao atualizar notas salvas.");
        }
    };

    const handleStartEdit = (item: EstablishmentDictionaryEntry) => {
        setEditingKey(item.nome_nota);
        setEditForm({
            nome_fantasia: item.nome_fantasia || "",
        });
    };

    const handleSaveEdit = async (nomeNota: string) => {
        try {
            const previous = dictionary.find((item) => item.nome_nota === nomeNota);
            const previousNomeFantasia = (previous?.nome_fantasia ?? "").trim();
            const nextNomeFantasia = (editForm.nome_fantasia ?? "").trim();

            if (!nextNomeFantasia) {
                notify.error("O nome fantasia não pode ficar vazio.");
                return;
            }

            const shouldOfferApplyToSaved = previousNomeFantasia !== nextNomeFantasia;

            await upsertEntry.mutateAsync({
                nomeNota,
                nomeFantasia: nextNomeFantasia,
            });

            setEditingKey(null);
            notify.success("Item atualizado!");

            if (shouldOfferApplyToSaved) {
                toast(
                    (t: Toast) => (
                        <div className="glass-card m-0 p-4 w-full max-w-[520px] flex gap-3 items-center">
                            <div className="flex-1">
                                <div className="text-white font-bold mb-1">
                                    Aplicar nas notas salvas?
                                </div>
                                <div className="text-slate-400 text-[0.85rem] leading-[1.35]">
                                    Atualiza o nome do estabelecimento de{" "}
                                    <strong className="text-slate-200">{nomeNota}</strong> para{" "}
                                    <strong className="text-slate-200">{nextNomeFantasia}</strong>{" "}
                                    em todas as notas salvas.
                                </div>
                            </div>

                            <div className="flex flex-col gap-2">
                                <button
                                    className="btn btn-success py-2 px-[0.9rem] rounded-[0.9rem] text-[0.9rem]"
                                    onClick={async () => {
                                        toast.dismiss(t.id);
                                        await applyChangesToSavedReceipts(
                                            nomeNota,
                                            nextNomeFantasia,
                                        );
                                    }}
                                >
                                    Aplicar
                                </button>
                                <button
                                    className="btn py-2 px-[0.9rem] rounded-[0.9rem] text-[0.9rem] bg-white/5 shadow-none"
                                    onClick={() => toast.dismiss(t.id)}
                                >
                                    Agora nao
                                </button>
                            </div>
                        </div>
                    ),
                    { duration: 10000 },
                );
            }
        } catch (err) {
            logger.error("EstablishmentDictionaryTab", "Erro ao atualizar item", err);
            notify.error("Erro ao salvar alteracoes.");
        }
    };

    const handleDeleteEntry = async (nomeNota: string) => {
        setConfirmDialog({
            title: "Remover item?",
            message: `Isso remove o mapeamento de "${nomeNota}" do dicionario.`,
            confirmText: "Remover",
            danger: true,
            onConfirm: async () => {
                try {
                    await deleteEntry.mutateAsync(nomeNota);
                    notify.success("Item removido!");
                } catch (err) {
                    logger.error("EstablishmentDictionaryTab", "Erro ao remover item", err);
                    notify.error("Erro ao remover item.");
                }
            },
        });
    };

    const handleAddEntry = async () => {
        const nomeNota = addForm.nome_nota.trim();
        const nomeFantasia = addForm.nome_fantasia.trim();

        if (!nomeNota) {
            notify.error("O nome da nota não pode ficar vazio.");
            return;
        }
        if (!nomeFantasia) {
            notify.error("O nome fantasia não pode ficar vazio.");
            return;
        }

        try {
            const exists = dictionary.find((item) => item.nome_nota === nomeNota);
            if (exists) {
                notify.error("Já existe um mapeamento para este estabelecimento.");
                return;
            }

            await upsertEntry.mutateAsync({
                nomeNota,
                nomeFantasia,
            });

            setIsAdding(false);
            setAddForm({ nome_nota: "", nome_fantasia: "" });
            notify.success("Item adicionado!");
        } catch (err) {
            logger.error("EstablishmentDictionaryTab", "Erro ao adicionar item", err);
            notify.error("Erro ao adicionar item.");
        }
    };

    const handleCancelAdd = () => {
        setIsAdding(false);
        setAddForm({ nome_nota: "", nome_fantasia: "" });
    };

    const handleClearDictionary = async () => {
        setConfirmDialog({
            title: "Limpar dicionario?",
            message: "Isso apagara todo o dicionario de estabelecimentos.",
            confirmText: "Limpar tudo",
            danger: true,
            onConfirm: async () => {
                try {
                    await clearDictionary.mutateAsync();
                    notify.success("Dicionario limpo com sucesso!");
                } catch (err) {
                    logger.error("EstablishmentDictionaryTab", "Erro ao limpar dicionario", err);
                    notify.error("Erro ao limpar dicionario.");
                }
            },
        });
    };

    // Se veio de um prefill (clicou no lápis no histórico)
    useEffect(() => {
        if (prefillNomeNota && !prefillApplied.current) {
            prefillApplied.current = true;
            const exists = dictionary.find((item) => item.nome_nota === prefillNomeNota);
            if (exists) {
                handleStartEdit(exists);
            } else {
                setIsAdding(true);
                setAddForm({
                    nome_nota: prefillNomeNota,
                    nome_fantasia: "",
                });
            }
            clearPrefill();
        }
    }, [prefillNomeNota, dictionary, clearPrefill]);

    const filteredDictionary = useMemo(() => {
        return filterBySearch(dictionary, searchQuery, ["nome_nota", "nome_fantasia"]);
    }, [dictionary, searchQuery]);

    const sortedDictionary = useMemo(() => {
        const customSorters = {
            recent: (a: EstablishmentDictionaryEntry, b: EstablishmentDictionaryEntry) => {
                const dateA = new Date(a.created_at || 0);
                const dateB = new Date(b.created_at || 0);
                return dateA.getTime() - dateB.getTime();
            },
            alpha: (a: EstablishmentDictionaryEntry, b: EstablishmentDictionaryEntry) => {
                const nameA = (a.nome_fantasia || a.nome_nota).toLowerCase();
                const nameB = (b.nome_fantasia || b.nome_nota).toLowerCase();
                return nameA.localeCompare(nameB);
            },
        };

        const sorted = sortItems(filteredDictionary, sortBy, sortDirection, customSorters);
        return { items: sorted, totalCount: sorted.length };
    }, [filteredDictionary, sortBy, sortDirection]);

    useEffect(() => {
        setVisibleCount(PAGE_SIZE);
    }, [searchQuery, sortBy, sortDirection]);

    const visibleItems = useMemo(
        () => sortedDictionary.items.slice(0, visibleCount),
        [sortedDictionary.items, visibleCount],
    );
    const hasMore = visibleItems.length < sortedDictionary.totalCount;

    return (
        <>
            <div className="dictionary-tab">
                <div className="flex justify-between items-center mb-5">
                    <h2 className="section-title mb-0">
                        <Book color="var(--primary)" size={20} />
                        Dicionario de Estabelecimentos
                    </h2>
                    <div className="flex gap-2">
                        <button
                            className="btn bg-green-500/10 border-none text-green-400 p-2 rounded-lg"
                            onClick={() => setIsAdding(true)}
                            title="Adicionar mapeamento"
                        >
                            <Plus size={20} />
                        </button>
                        <button
                            className="btn bg-red-500/10 border-none text-red-400 p-2 rounded-lg"
                            onClick={handleClearDictionary}
                            title="Limpar Dicionario"
                        >
                            <RotateCcw size={20} />
                        </button>
                    </div>
                </div>

                <UniversalSearchBar
                    placeholder="Pesquisar estabelecimento..."
                    value={searchQuery}
                    onChange={setSearchQuery}
                    sortValue={sortBy}
                    onSortChange={setSortBy}
                    sortOrder={sortDirection}
                    onSortOrderChange={setSortDirection}
                    sortOptions={[
                        { value: "recent", label: "RECENTE" },
                        { value: "alpha", label: "A-Z" },
                    ]}
                    extraActions={
                        <div className="text-xs text-slate-500">
                            Exibindo {visibleItems.length} de {sortedDictionary.totalCount} itens
                        </div>
                    }
                />

                <div className="items-list gap-4">
                    {loading ? (
                        <div className="text-center p-12">
                            <Skeleton width="100%" height="80px" className="mb-4" />
                            <Skeleton width="100%" height="80px" />
                        </div>
                    ) : visibleItems.length === 0 && !isAdding ? (
                        <div className="glass-card text-center p-12">
                            <p className="text-slate-500">Nenhum item encontrado no dicionario.</p>
                        </div>
                    ) : (
                        <>
                            {isAdding && (
                                <div className="glass-card animated-item mb-0 p-4">
                                    <div className="flex flex-col gap-3">
                                        <div className="text-xs text-slate-500 font-bold">NOVO MAPEAMENTO</div>
                                        <input
                                            type="text"
                                            className="search-input bg-[var(--bg-color)]"
                                            value={addForm.nome_nota}
                                            onChange={(e) =>
                                                setAddForm({ ...addForm, nome_nota: e.target.value })
                                            }
                                            placeholder="Nome exato na nota"
                                        />
                                        <input
                                            type="text"
                                            className="search-input bg-[var(--bg-color)]"
                                            value={addForm.nome_fantasia}
                                            onChange={(e) =>
                                                setAddForm({ ...addForm, nome_fantasia: e.target.value })
                                            }
                                            placeholder="Nome fantasia"
                                        />
                                        <div className="flex gap-2">
                                            <button className="btn btn-success flex-1" onClick={handleAddEntry}>
                                                <Save size={18} /> Adicionar
                                            </button>
                                            <button className="btn flex-1" onClick={handleCancelAdd}>
                                                <X size={18} /> Cancelar
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                            {visibleItems.map((item) => (
                                <div key={item.nome_nota}>
                                    {editingKey === item.nome_nota ? (
                                        <div className="glass-card animated-item mb-0 p-4">
                                            <div className="flex flex-col gap-3">
                                                <div className="text-xs text-slate-500 font-bold">
                                                    NOME NA NOTA: {item.nome_nota}
                                                </div>
                                                <input
                                                    type="text"
                                                    className="search-input bg-[var(--bg-color)]"
                                                    value={editForm.nome_fantasia}
                                                    onChange={(e) =>
                                                        setEditForm({ nome_fantasia: e.target.value })
                                                    }
                                                    placeholder="Nome fantasia"
                                                />
                                                <div className="flex gap-2">
                                                    <button className="btn btn-success flex-1" onClick={() => handleSaveEdit(item.nome_nota)}>
                                                        <Save size={18} /> Salvar
                                                    </button>
                                                    <button className="btn flex-1" onClick={() => setEditingKey(null)}>
                                                        <X size={18} /> Cancelar
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="glass-card animated-item mb-0 p-4">
                                            <div className="flex justify-between items-center">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="text-white font-semibold">
                                                            {item.nome_fantasia || "Sem nome"}
                                                        </span>
                                                    </div>
                                                    <div className="text-xs text-slate-500 italic">
                                                        Original: {item.nome_nota}
                                                    </div>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => handleStartEdit(item)}
                                                        className="bg-blue-500/10 border-none rounded-lg w-9 h-9 flex items-center justify-center text-[var(--primary)]"
                                                    >
                                                        <Edit3 size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteEntry(item.nome_nota)}
                                                        className="bg-red-500/10 border-none rounded-lg w-9 h-9 flex items-center justify-center text-red-500"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                            {hasMore && (
                                <div className="flex justify-center mt-2">
                                    <button className="btn" onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}>
                                        Carregar mais
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
            <ConfirmDialog
                isOpen={Boolean(confirmDialog)}
                title={confirmDialog?.title || ""}
                message={confirmDialog?.message || ""}
                confirmText={confirmDialog?.confirmText}
                cancelText={confirmDialog?.cancelText}
                danger={confirmDialog?.danger}
                busy={confirmBusy}
                onCancel={closeConfirm}
                onConfirm={runConfirm}
            />
        </>
    );
}

export default EstablishmentDictionaryTab;