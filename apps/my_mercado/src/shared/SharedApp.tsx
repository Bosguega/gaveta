import { useEffect, useState } from "react";
import { getSharedList, toggleSharedItem } from "../services/sharedListService";
import type { SharedList as SharedListType, SharedListItem as SharedListItemType } from "../services/sharedListService";
import "./shared.css";

type Props = {
    code: string;
};

export function SharedApp({ code }: Props) {
    const [list, setList] = useState<SharedListType | null>(null);
    const [items, setItems] = useState<SharedListItemType[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        (async () => {
            try {
                const data = await getSharedList(code);
                if (!data) {
                    setError("Lista não encontrada ou código inválido.");
                    return;
                }
                setList(data.list);
                setItems(data.items);
            } catch {
                setError("Erro ao carregar a lista.");
            } finally {
                setLoading(false);
            }
        })();
    }, [code]);

    const handleToggle = async (itemId: string, checked: boolean) => {
        // Otimista: atualiza UI imediatamente
        setItems((prev) =>
            prev.map((item) =>
                item.id === itemId ? { ...item, checked: !checked } : item,
            ),
        );

        const success = await toggleSharedItem(itemId, !checked);
        if (!success) {
            // Reverte se falhar
            setItems((prev) =>
                prev.map((item) =>
                    item.id === itemId ? { ...item, checked } : item,
                ),
            );
        }
    };

    if (loading) {
        return (
            <div className="shared-container">
                <div className="shared-card">
                    <p className="shared-loading">Carregando lista...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="shared-container">
                <div className="shared-card">
                    <h1 className="shared-title">Lista de Compras</h1>
                    <p className="shared-error">{error}</p>
                </div>
            </div>
        );
    }

    const checkedCount = items.filter((i) => i.checked).length;

    return (
        <div className="shared-container">
            <div className="shared-card">
                <h1 className="shared-title">{list?.name || "Lista de Compras"}</h1>

                <div className="shared-progress">
                    <span>{checkedCount}/{items.length} itens</span>
                    <div className="shared-progress-bar">
                        <div
                            className="shared-progress-fill"
                            style={{ width: items.length > 0 ? `${(checkedCount / items.length) * 100}%` : "0%" }}
                        />
                    </div>
                </div>

                <ul className="shared-items">
                    {items.map((item) => (
                        <li key={item.id} className="shared-item">
                            <label className="shared-label">
                                <input
                                    type="checkbox"
                                    checked={item.checked}
                                    onChange={() => handleToggle(item.id, item.checked)}
                                    className="shared-checkbox"
                                />
                                <span className={item.checked ? "shared-name checked" : "shared-name"}>
                                    {item.name}
                                </span>
                            </label>
                            {item.quantity && (
                                <span className="shared-qty">{item.quantity}</span>
                            )}
                            {item.note && (
                                <p className="shared-note">{item.note}</p>
                            )}
                        </li>
                    ))}
                </ul>

                {items.length === 0 && (
                    <p className="shared-empty">Nenhum item nesta lista.</p>
                )}

                <p className="shared-footer">
                    Criada por compartilhamento via código <strong>{code}</strong>
                </p>
            </div>
        </div>
    );
}