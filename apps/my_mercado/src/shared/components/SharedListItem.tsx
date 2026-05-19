import type { SharedListItem as SharedListItemData } from "../../services/sharedListService";

type SharedListItemProps = {
    item: SharedListItemData;
    onToggle: () => void;
    onRemove: () => void;
};

/**
 * Item de lista compartilhada — estilo papel.
 * Checkbox grande, nome, quantidade, nota.
 * Sem ícones, sem efeitos, sem cards.
 */
export function SharedListItem({ item, onToggle, onRemove }: SharedListItemProps) {
    return (
        <li
            className={`shared-item ${item.checked ? "checked" : ""}`}
            onClick={onToggle}
        >
            <div className="shared-checkbox">
                <span className="shared-checkbox-mark">✓</span>
            </div>

            <div className="shared-item-content">
                <div className="shared-item-row">
                    <span className="shared-item-name">{item.name}</span>
                    {item.quantity && (
                        <span className="shared-item-qty">{item.quantity}</span>
                    )}
                </div>
                {item.note && (
                    <div className="shared-item-note">
                        {item.note.length > 100 ? item.note.slice(0, 100) + "…" : item.note}
                    </div>
                )}
            </div>

            <button
                className="shared-item-remove"
                onClick={(e) => {
                    e.stopPropagation();
                    onRemove();
                }}
                aria-label="Remover item"
            >
                ×
            </button>
        </li>
    );
}
