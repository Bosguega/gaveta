import { useState, useCallback } from "react";
import { useSharedList } from "../hooks/useSharedList";
import { SharedListItem } from "./SharedListItem";

type SharedListViewProps = {
    code: string;
};

/**
 * View principal do shared client.
 * Papel de mercado sincronizado: header, lista, input.
 * Sem ícones, sem cards, sem animações.
 */
export function SharedListView({ code }: SharedListViewProps) {
    const { list, items, loading, error, toggleItem, addItem, removeItem } =
        useSharedList(code);

    const [newItemName, setNewItemName] = useState("");
    const [adding, setAdding] = useState(false);

    const handleAddItem = useCallback(async () => {
        const name = newItemName.trim();
        if (!name || adding) return;

        setAdding(true);
        const ok = await addItem(name);
        setAdding(false);

        if (ok) {
            setNewItemName("");
        }
    }, [newItemName, adding, addItem]);

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key === "Enter") {
                e.preventDefault();
                void handleAddItem();
            }
        },
        [handleAddItem],
    );

    // Loading
    if (loading) {
        return (
            <div className="shared-loading">
                Carregando lista...
            </div>
        );
    }

    // Error / not found
    if (error || !list) {
        return (
            <div className="shared-error">
                <h2>Lista não encontrada</h2>
                <p>{error || "O link pode estar quebrado ou a lista foi removida."}</p>
            </div>
        );
    }

    // Sort: unchecked first, then by created_at
    const unchecked = items.filter((i) => !i.checked);
    const checked = items.filter((i) => i.checked);
    const sortedItems = [
        ...unchecked.sort((a, b) => a.created_at.localeCompare(b.created_at)),
        ...checked.sort((a, b) => a.created_at.localeCompare(b.created_at)),
    ];

    const total = items.length;
    const done = checked.length;

    return (
        <>
            {/* Header */}
            <div className="shared-header">
                <h1>{list.name}</h1>
                <div className="shared-count">
                    {done}/{total} {total === 1 ? "item" : "itens"}
                </div>
                {total > 0 && (
                    <div className="shared-progress">
                        <div
                            className="shared-progress-fill"
                            style={{ width: `${(done / total) * 100}%` }}
                        />
                    </div>
                )}
            </div>

            {/* Lista */}
            {sortedItems.length === 0 ? (
                <div className="shared-empty">
                    Nenhum item na lista.
                </div>
            ) : (
                <ul className="shared-list">
                    {sortedItems.map((item) => (
                        <SharedListItem
                            key={item.id}
                            item={item}
                            onToggle={() => void toggleItem(item.id, !item.checked)}
                            onRemove={() => void removeItem(item.id)}
                        />
                    ))}
                </ul>
            )}

            {/* Adicionar item */}
            <div className="shared-add">
                <input
                    type="text"
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="adicionar item"
                    disabled={adding}
                />
                <button
                    onClick={handleAddItem}
                    disabled={adding || !newItemName.trim()}
                    aria-label="Adicionar item"
                >
                    +
                </button>
            </div>

            {/* Sync indicator */}
            <div className="shared-sync">
                sincronizado
            </div>
        </>
    );
}
