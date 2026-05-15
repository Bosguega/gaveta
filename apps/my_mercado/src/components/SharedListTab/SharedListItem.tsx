import { CheckCircle2, Circle, Trash2 } from "lucide-react";
import type { SharedListItem as SharedListItemData } from "../../services/sharedListService.ts";

type SharedListItemProps = {
    item: SharedListItemData;
    onToggle: () => void;
    onRemove: () => void;
};

const NOTE_CHARS_LIMIT = 120;

/**
 * Item de lista compartilhada — versão simplificada.
 * Mostra nome, observação discreta, checkbox e botão de remover.
 */
export function SharedListItem({ item, onToggle, onRemove }: SharedListItemProps) {
    const truncatedNote = item.note && item.note.length > NOTE_CHARS_LIMIT
        ? item.note.slice(0, NOTE_CHARS_LIMIT) + "…"
        : item.note;

    return (
        <div
            className={`glass-card p-4 flex gap-3 items-start ${item.checked ? "border-emerald-500/30 opacity-75" : "border-[var(--card-border)]"}`}
        >
            <button
                onClick={onToggle}
                className={`bg-transparent border-none p-0 cursor-pointer mt-0.5 shrink-0 ${item.checked ? "text-[var(--success)]" : "text-slate-500"}`}
                aria-label={item.checked ? "Desmarcar item" : "Marcar item"}
            >
                {item.checked ? <CheckCircle2 size={22} /> : <Circle size={22} />}
            </button>

            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                    <h3 className={`text-slate-50 text-base break-words ${item.checked ? "line-through" : "no-underline"}`}>
                        {item.name}
                    </h3>
                    <button
                        onClick={onRemove}
                        className="bg-red-500/10 border-none w-[30px] h-[30px] rounded-lg flex items-center justify-center text-red-500 cursor-pointer shrink-0 hover:bg-red-500/20"
                        title="Remover item"
                        aria-label="Remover item"
                    >
                        <Trash2 size={15} />
                    </button>
                </div>

                {item.quantity && (
                    <p className="text-slate-400 text-[0.8rem] mt-0.5">
                        Quantidade: {item.quantity}
                    </p>
                )}

                {truncatedNote && (
                    <p className="text-slate-500 text-[0.75rem] mt-0.5 italic leading-relaxed">
                        {truncatedNote}
                    </p>
                )}
            </div>
        </div>
    );
}