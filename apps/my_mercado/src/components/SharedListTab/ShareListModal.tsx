import { useState, useEffect } from "react";
import { X, Trash2 } from "lucide-react";
import { publishList, unpublishList, updateSharedListItems, getSharedListsByOwner } from "../../services/sharedListService.ts";
import { normalizeKey } from "../../utils/normalize";
import { notify } from "../../utils/notifications.ts";
import type { ShoppingListItem } from "../../types/ui.ts";
import type { PurchaseHistoryEntry } from "../../hooks/queries/usePurchaseHistory";
import type { SharedList } from "../../services/sharedListService";

type ShareListModalProps = {
    isOpen: boolean;
    onClose: () => void;
    listId: string;
    listName: string;
    ownerId: string;
    shareCode: string | null;
    items: ShoppingListItem[];
    itemsHistory: Record<string, PurchaseHistoryEntry[]>;
};

/**
 * Enriquece o note do item com as últimas 3 compras no formato "papel de mercado".
 * Se já existe nota manual, mantém ela e adiciona o histórico abaixo.
 */
function enrichNote(
    originalNote: string | undefined,
    history: PurchaseHistoryEntry[] | undefined,
): string | undefined {
    if (!history || history.length === 0) {
        return originalNote || undefined;
    }

    const top3 = history.slice(0, 3);
    const lines = top3.map(
        (entry) =>
            `${entry.date} R$${entry.unitPrice.toFixed(2).replace(".", ",")} (${entry.store})`,
    );

    const historyBlock = `Últimas:\n${lines.join("\n")}`;

    if (originalNote) {
        return `${originalNote}\n\n${historyBlock}`;
    }

    return historyBlock;
}

/**
 * Modal de compartilhamento de lista.
 * Permite criar/renovar/remover o link de compartilhamento,
 * e gerenciar (listar/apagar) todas as listas compartilhadas do usuário.
 */
export function ShareListModal({
    isOpen,
    onClose,
    listId: _listId,
    listName,
    ownerId,
    shareCode,
    items,
    itemsHistory,
}: ShareListModalProps) {
    const [code, setCode] = useState<string | null>(shareCode);
    const [publishing, setPublishing] = useState(false);
    const [unpublishing, setUnpublishing] = useState(false);
    const [updating, setUpdating] = useState(false);
    const [sharedLists, setSharedLists] = useState<SharedList[]>([]);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    // Carrega listas compartilhadas ao abrir o modal
    useEffect(() => {
        if (isOpen && ownerId) {
            getSharedListsByOwner(ownerId).then(setSharedLists).catch(() => { });
        }
    }, [isOpen, ownerId]);

    if (!isOpen) return null;

    const baseUrl = window.location.origin + window.location.pathname.replace(/\/$/, "");
    const shareLink = code ? `${baseUrl}/s/${code}` : null;

    const enrichItemsForPublish = () =>
        items.map((item) => ({
            name: item.name,
            normalized_name: item.normalized_name,
            quantity: item.quantity,
            note: enrichNote(item.note, itemsHistory[normalizeKey(item.normalized_name)]),
        }));

    const handlePublish = async () => {
        setPublishing(true);
        try {
            const result = await publishList({
                ownerId,
                name: listName,
                items: enrichItemsForPublish(),
            });
            setCode(result.code);
            // Recarrega a lista de compartilhadas
            const updated = await getSharedListsByOwner(ownerId);
            setSharedLists(updated);
            notify.success("Lista compartilhada com sucesso!");
        } catch (_err) {
            notify.error("Erro ao compartilhar lista.");
        } finally {
            setPublishing(false);
        }
    };

    const handleUnpublish = async () => {
        if (!code) return;
        setUnpublishing(true);
        try {
            await unpublishList(code, ownerId);
            setCode(null);
            // Recarrega a lista de compartilhadas
            const updated = await getSharedListsByOwner(ownerId);
            setSharedLists(updated);
            notify.success("Compartilhamento removido.");
        } catch (_err) {
            notify.error("Erro ao remover compartilhamento.");
        } finally {
            setUnpublishing(false);
        }
    };

    const handleUpdateItems = async () => {
        if (!code) return;
        setUpdating(true);
        try {
            await updateSharedListItems(code, ownerId, enrichItemsForPublish());
            notify.success("Lista compartilhada atualizada!");
        } catch (_err) {
            notify.error("Erro ao atualizar lista compartilhada.");
        } finally {
            setUpdating(false);
        }
    };

    const handleDeleteSharedList = async (targetCode: string) => {
        setDeletingId(targetCode);
        try {
            await unpublishList(targetCode, ownerId);
            const updated = await getSharedListsByOwner(ownerId);
            setSharedLists(updated);
            // Se apagou a lista ativa, limpa o código
            if (targetCode === code) {
                setCode(null);
            }
            notify.success("Lista compartilhada apagada.");
        } catch {
            notify.error("Erro ao apagar lista.");
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="glass-card max-w-md w-full p-6 relative max-h-[90vh] overflow-y-auto">
                {/* Close */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 bg-white/5 border-none rounded-full w-8 h-8 flex items-center justify-center text-slate-400 hover:bg-white/10 cursor-pointer"
                >
                    <X size={18} />
                </button>

                <h2 className="text-lg font-bold text-slate-50 mb-1">Compartilhar Lista</h2>
                <p className="text-slate-400 text-sm mb-4">
                    Qualquer pessoa com o link pode ver e editar esta lista.
                </p>

                {code ? (
                    <>
                        {/* Link ativo */}
                        <div className="bg-slate-900/60 rounded-xl p-4 mb-4 border border-white/5">
                            <label className="text-xs text-slate-400 uppercase tracking-wider font-semibold block mb-2">
                                Link compartilhado
                            </label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    readOnly
                                    value={shareLink ?? ""}
                                    className="flex-1 bg-slate-800/60 border border-white/10 rounded-lg px-3 py-2 text-slate-200 text-sm outline-none"
                                />
                                <button
                                    onClick={() => {
                                        if (shareLink) {
                                            navigator.clipboard.writeText(shareLink);
                                            notify.success("Link copiado!");
                                        }
                                    }}
                                    className="bg-blue-500/20 border-none rounded-lg p-2 text-blue-400 hover:bg-blue-500/30 cursor-pointer"
                                    title="Copiar link"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                                </button>
                            </div>
                            <p className="text-xs text-slate-500 mt-2">
                                Código: <span className="text-blue-400 font-mono">{code}</span>
                            </p>
                        </div>

                        {/* Ações */}
                        <div className="flex flex-col gap-2 mb-4">
                            <button
                                onClick={handleUpdateItems}
                                disabled={updating}
                                className="btn bg-emerald-500/15 border-emerald-500/30 text-emerald-300 w-full flex items-center justify-center gap-2 hover:bg-emerald-500/25 disabled:opacity-50"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={updating ? "animate-spin" : ""}><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></svg>
                                {updating ? "Atualizando..." : "Atualizar lista compartilhada"}
                            </button>

                            <button
                                onClick={handleUnpublish}
                                disabled={unpublishing}
                                className="btn bg-red-500/10 border-red-500/20 text-red-400 w-full flex items-center justify-center gap-2 hover:bg-red-500/20 disabled:opacity-50"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                                {unpublishing ? "Removendo..." : "Remover compartilhamento"}
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        {/* Sem link ainda */}
                        <div className="bg-slate-900/60 rounded-xl p-6 mb-4 border border-white/5 text-center">
                            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500 mx-auto mb-3"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" /></svg>
                            <p className="text-slate-400 text-sm">
                                Esta lista ainda não está compartilhada.
                            </p>
                            <p className="text-slate-500 text-xs mt-1">
                                Ao compartilhar, os itens atuais serão copiados para um link público.
                            </p>
                        </div>

                        <button
                            onClick={handlePublish}
                            disabled={publishing}
                            className="btn bg-blue-500/20 border-blue-500/30 text-blue-300 w-full flex items-center justify-center gap-2 hover:bg-blue-500/30 disabled:opacity-50 mb-4"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={publishing ? "animate-pulse" : ""}><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" /></svg>
                            {publishing ? "Publicando..." : "Criar link de compartilhamento"}
                        </button>
                    </>
                )}

                {/* Lista de listas compartilhadas */}
                {sharedLists.length > 0 && (
                    <div className="border-t border-white/10 pt-4 mt-2">
                        <h3 className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-3">
                            Minhas listas compartilhadas ({sharedLists.length})
                        </h3>
                        <div className="flex flex-col gap-2">
                            {sharedLists.map((sl) => {
                                const isActive = code === sl.code;
                                return (
                                    <div
                                        key={sl.id}
                                        className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm ${isActive
                                            ? "bg-blue-500/10 border border-blue-500/20"
                                            : "bg-slate-900/40"
                                            }`}
                                    >
                                        <div className="min-w-0 flex-1">
                                            <p className="text-slate-200 truncate font-medium">
                                                {sl.name}
                                                {isActive && (
                                                    <span className="ml-2 text-[0.6rem] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded-full">
                                                        Ativa
                                                    </span>
                                                )}
                                            </p>
                                            <p className="text-[0.65rem] text-slate-500 font-mono truncate">
                                                {baseUrl}/s/{sl.code}
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => handleDeleteSharedList(sl.code)}
                                            disabled={deletingId === sl.code}
                                            className="bg-red-500/10 border-none rounded-lg w-7 h-7 flex items-center justify-center text-red-400 hover:bg-red-500/20 shrink-0 disabled:opacity-40 cursor-pointer"
                                            title="Apagar lista compartilhada"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {sharedLists.length === 0 && code === null && (
                    <p className="text-center text-slate-600 text-xs mt-2">
                        Nenhuma lista compartilhada ainda.
                    </p>
                )}

                <p className="text-center text-slate-600 text-xs mt-4">
                    Última escrita vence. Todos com o link podem editar.
                </p>
            </div>
        </div>
    );
}