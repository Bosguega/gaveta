import { useState, useCallback } from "react";
import { ListChecks, ArrowLeft, RefreshCw, Plus } from "lucide-react";
import { useSharedList } from "../../hooks/useSharedList.ts";
import { SharedListItem } from "./SharedListItem.tsx";
import { notify } from "../../utils/notifications.ts";

type SharedListViewProps = {
    code: string;
    onClose: () => void;
};

/**
 * Tela de visualização de lista compartilhada.
 * Interface simplificada: apenas checkbox, adicionar e remover itens.
 * Sem abas, sem configurações, sem criação de lista.
 */
export function SharedListView({ code, onClose }: SharedListViewProps) {
    const { list, items, loading, error, toggleItem, addItem, removeItem } =
        useSharedList(code);

    const [newItemName, setNewItemName] = useState("");
    const [adding, setAdding] = useState(false);

    const handleAddItem = useCallback(async () => {
        const name = newItemName.trim();
        if (!name) return;

        setAdding(true);
        const ok = await addItem(name);
        setAdding(false);

        if (ok) {
            setNewItemName("");
        } else {
            notify.error("Erro ao adicionar item.");
        }
    }, [newItemName, addItem]);

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key === "Enter") {
                e.preventDefault();
                void handleAddItem();
            }
        },
        [handleAddItem],
    );

    // Loading state
    if (loading) {
        return (
            <div className="app-container flex items-center justify-center min-h-screen">
                <RefreshCw className="animate-spin text-blue-500" size={32} />
            </div>
        );
    }

    // Error or not found
    if (error || !list) {
        return (
            <div className="app-container flex flex-col items-center justify-center min-h-screen p-6 text-center">
                <div className="glass-card max-w-md w-full p-6">
                    <h2 className="text-white mb-4">Lista não encontrada</h2>
                    <p className="text-slate-400 mb-6">
                        {error || "O link pode estar quebrado ou a lista foi removida."}
                    </p>
                    <button className="btn w-full" onClick={onClose}>
                        Voltar
                    </button>
                </div>
            </div>
        );
    }

    // Sort: unchecked first, then by created_at
    const sortedItems = [...items].sort((a, b) => {
        if (a.checked !== b.checked) return a.checked ? 1 : -1;
        return a.created_at.localeCompare(b.created_at);
    });

    return (
        <div className="app-container min-h-screen flex flex-col">
            {/* Header */}
            <header className="header flex items-center gap-4">
                <button
                    onClick={onClose}
                    className="bg-white/5 border-none rounded-full w-10 h-10 flex items-center justify-center text-slate-300 hover:bg-white/10 cursor-pointer"
                    aria-label="Voltar"
                >
                    <ArrowLeft size={20} />
                </button>
                <div className="flex-1">
                    <h1 className="text-xl">{list.name}</h1>
                    <p className="text-xs text-slate-400">
                        Lista Compartilhada · {items.filter((i) => !i.checked).length} pendentes
                    </p>
                </div>
                <div className="bg-blue-500/20 text-blue-400 p-2 rounded-lg">
                    <ListChecks size={20} />
                </div>
            </header>

            <main className="p-4 flex-1">
                {/* Add item input */}
                <div className="glass-card p-3 mb-4 flex items-center gap-2">
                    <input
                        type="text"
                        value={newItemName}
                        onChange={(e) => setNewItemName(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Adicionar item..."
                        className="flex-1 bg-transparent border-none outline-none text-slate-50 text-sm placeholder:text-slate-600"
                        disabled={adding}
                        autoFocus
                    />
                    <button
                        onClick={handleAddItem}
                        disabled={adding || !newItemName.trim()}
                        className="bg-blue-500/20 border-none rounded-lg p-2 text-blue-400 hover:bg-blue-500/30 disabled:opacity-30 cursor-pointer"
                        aria-label="Adicionar item"
                    >
                        <Plus size={18} />
                    </button>
                </div>

                {/* Items list */}
                <div className="flex flex-col gap-3">
                    {sortedItems.length === 0 ? (
                        <div className="glass-card p-6 text-center">
                            <p className="text-slate-500">
                                Nenhum item na lista. Adicione itens para começar.
                            </p>
                        </div>
                    ) : (
                        sortedItems.map((item) => (
                            <SharedListItem
                                key={item.id}
                                item={item}
                                onToggle={() => void toggleItem(item.id, !item.checked)}
                                onRemove={() => void removeItem(item.id)}
                            />
                        ))
                    )}
                </div>
            </main>
        </div>
    );
}