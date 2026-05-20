import { useState } from "react";
import type { SharedListItem as SharedListItemData } from "../../services/sharedListService";

type SharedListItemProps = {
    item: SharedListItemData;
    onToggle: () => void;
    onRemove: () => void;
};

/**
 * Separa o note em parte manual e bloco de histórico.
 * O bloco de histórico é o trecho que começa com "Últimas:".
 */
function splitNote(note: string): { manual: string; history: string } {
    const idx = note.indexOf("Últimas:");
    if (idx === -1) {
        return { manual: note, history: "" };
    }
    return {
        manual: note.slice(0, idx).trim(),
        history: note.slice(idx),
    };
}

/**
 * Item de lista compartilhada — estilo papel.
 * Checkbox grande, nome, quantidade, nota.
 * Se a nota contém bloco "Últimas:", ele é exibido como collapsible.
 */
export function SharedListItem({ item, onToggle, onRemove }: SharedListItemProps) {
    const [historyOpen, setHistoryOpen] = useState(false);

    const { manual, history } = splitNote(item.note ?? "");

    const historyLines = history
        .replace("Últimas:", "")
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);

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

                {/* Nota manual */}
                {manual && (
                    <div className="shared-note-manual">
                        {manual}
                    </div>
                )}

                {/* Histórico collapsible */}
                {historyLines.length > 0 && (
                    <div className="shared-history">
                        <span
                            className="shared-history-toggle"
                            onClick={(e) => {
                                e.stopPropagation();
                                setHistoryOpen((v) => !v);
                            }}
                        >
                            {historyOpen ? "▾" : "▸"} últimas compras
                        </span>
                        {historyOpen && (
                            <div className="shared-history-lines">
                                {historyLines.map((line, i) => (
                                    <div key={i} className="shared-history-line">
                                        {line}
                                    </div>
                                ))}
                            </div>
                        )}
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