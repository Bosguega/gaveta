import { useState } from "react";
import { X, Copy, RefreshCw, Share2, AlertTriangle } from "lucide-react";
import { publishList, unpublishList, updateSharedListItems } from "../../services/sharedListService.ts";
import { notify } from "../../utils/notifications.ts";
import type { ShoppingListItem } from "../../types/ui.ts";

type ShareListModalProps = {
    isOpen: boolean;
    onClose: () => void;
    listId: string;
    listName: string;
    ownerId: string;
    shareCode: string | null;
    items: ShoppingListItem[];
};

/**
 * Modal de compartilhamento de lista.
 * Permite criar/renovar/remover o link de compartilhamento.
 */
export function ShareListModal({
    isOpen,
    onClose,
    listId: _listId,
    listName,
    ownerId,
    shareCode,
    items,
}: ShareListModalProps) {
    const [code, setCode] = useState<string | null>(shareCode);
    const [publishing, setPublishing] = useState(false);
    const [unpublishing, setUnpublishing] = useState(false);
    const [updating, setUpdating] = useState(false);

    if (!isOpen) return null;

    const baseUrl = window.location.origin + window.location.pathname.replace(/\/$/, "");
    const shareLink = code ? `${baseUrl}/s/${code}` : null;

    const handlePublish = async () => {
        setPublishing(true);
        try {
            const result = await publishList({
                ownerId,
                name: listName,
                items: items.map((item) => ({
                    name: item.name,
                    normalized_key: item.normalized_key,
                    quantity: item.quantity,
                    note: item.note,
                })),
            });
            setCode(result.code);
            notify.success("Lista compartilhada com sucesso!");
        } catch (err) {
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
            notify.success("Compartilhamento removido.");
        } catch (err) {
            notify.error("Erro ao remover compartilhamento.");
        } finally {
            setUnpublishing(false);
        }
    };

    const handleUpdateItems = async () => {
        if (!code) return;
        setUpdating(true);
        try {
            await updateSharedListItems(code, ownerId, items.map((item) => ({
                name: item.name,
                normalized_key: item.normalized_key,
                quantity: item.quantity,
                note: item.note,
            })));
            notify.success("Lista compartilhada atualizada!");
        } catch (err) {
            notify.error("Erro ao atualizar lista compartilhada.");
        } finally {
            setUpdating(false);
        }
    };

    const handleCopyLink = async () => {
        if (!shareLink) return;
        try {
            await navigator.clipboard.writeText(shareLink);
            notify.success("Link copiado!");
        } catch {
            notify.error("Erro ao copiar link.");
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="glass-card max-w-md w-full p-6 relative">
                {/* Close */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 bg-white/5 border-none rounded-full w-8 h-8 flex items-center justify-center text-slate-400 hover:bg-white/10 cursor-pointer"
                >
                    <X size={18} />
                </button>

                <h2 className="text-lg font-bold text-slate-50 mb-1">Compartilhar Lista</h2>
                <p className="text-slate-400 text-sm mb-6">
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
                                    onClick={handleCopyLink}
                                    className="bg-blue-500/20 border-none rounded-lg p-2 text-blue-400 hover:bg-blue-500/30 cursor-pointer"
                                    title="Copiar link"
                                >
                                    <Copy size={18} />
                                </button>
                            </div>
                            <p className="text-xs text-slate-500 mt-2">
                                Código: <span className="text-blue-400 font-mono">{code}</span>
                            </p>
                        </div>

                        {/* Ações */}
                        <div className="flex flex-col gap-2">
                            <button
                                onClick={handleUpdateItems}
                                disabled={updating}
                                className="btn bg-emerald-500/15 border-emerald-500/30 text-emerald-300 w-full flex items-center justify-center gap-2 hover:bg-emerald-500/25 disabled:opacity-50"
                            >
                                <RefreshCw size={16} className={updating ? "animate-spin" : ""} />
                                {updating ? "Atualizando..." : "Atualizar lista compartilhada"}
                            </button>

                            <button
                                onClick={handleUnpublish}
                                disabled={unpublishing}
                                className="btn bg-red-500/10 border-red-500/20 text-red-400 w-full flex items-center justify-center gap-2 hover:bg-red-500/20 disabled:opacity-50"
                            >
                                <AlertTriangle size={16} />
                                {unpublishing ? "Removendo..." : "Remover compartilhamento"}
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        {/* Sem link ainda */}
                        <div className="bg-slate-900/60 rounded-xl p-6 mb-4 border border-white/5 text-center">
                            <Share2 size={32} className="text-slate-500 mx-auto mb-3" />
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
                            className="btn bg-blue-500/20 border-blue-500/30 text-blue-300 w-full flex items-center justify-center gap-2 hover:bg-blue-500/30 disabled:opacity-50"
                        >
                            <Share2 size={16} className={publishing ? "animate-pulse" : ""} />
                            {publishing ? "Publicando..." : "Criar link de compartilhamento"}
                        </button>
                    </>
                )}

                <p className="text-center text-slate-600 text-xs mt-4">
                    Última escrita vence. Todos com o link podem editar.
                </p>
            </div>
        </div>
    );
}