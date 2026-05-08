import React, { useMemo, useCallback } from "react";
import { Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { parseBRL, formatBRL } from "../utils/currency";
import { calculateReceiptTotal } from "../utils/analytics";
import { formatToBR } from "../utils/date";
import type { Receipt, ReceiptItem } from "../types/domain";

interface ReceiptCardProps {
    receipt: Receipt;
    isExpanded: boolean;
    onToggle: (id: string) => void;
    onDelete: (id: string) => void;
}

export const ReceiptCard = React.memo(function ReceiptCard({
    receipt,
    isExpanded,
    onToggle,
    onDelete,
}: ReceiptCardProps) {
    // Memoizar o cálculo do total
    const total = useMemo(() => {
        return calculateReceiptTotal(receipt, parseBRL);
    }, [receipt]);
    const displayDate = useMemo(() => formatToBR(receipt.date) || receipt.date, [receipt.date]);

    // Memoizar o callback de toggle
    const handleToggle = useCallback(() => {
        onToggle(receipt.id);
    }, [receipt.id, onToggle]);

    // Memoizar o callback de delete
    const handleDelete = useCallback(
        (e: React.MouseEvent) => {
            e.stopPropagation();
            onDelete(receipt.id);
        },
        [receipt.id, onDelete],
    );

    return (
        <div className="glass-card animated-item p-0 overflow-hidden mb-0">
            {/* Header */}
            <div
                onClick={handleToggle}
                className="p-5 cursor-pointer relative"
            >
                <div className="flex justify-between items-start mb-2">
                    <div>
                        <h3 className="text-slate-50 text-[1.1rem] mb-1">
                            {receipt.establishment}
                        </h3>
                        <div className="flex gap-4 items-center">
                            <span className="text-slate-400 text-xs">
                                {displayDate}
                            </span>
                            <span className="bg-blue-500/20 text-[var(--primary)] px-2 py-0.5 rounded-full text-xs">
                                {receipt.items.length} itens
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-[var(--success)] font-bold text-[1.1rem] whitespace-nowrap">
                            R$ {total.toFixed(2).replace(".", ",")}
                        </span>
                        <button
                            onClick={handleDelete}
                            className="bg-red-500/10 border-none rounded-lg w-8 h-8 flex items-center justify-center text-red-500 cursor-pointer hover:bg-red-500/20"
                        >
                            <Trash2 size={16} />
                        </button>
                    </div>
                </div>

                <div className="flex justify-center mt-2 text-slate-500">
                    {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </div>
            </div>

            {/* Expanded Details */}
            {isExpanded && (
                <div className="animated-expand bg-slate-900/30 border-t border-[var(--card-border)] p-4 overflow-hidden">
                    {receipt.items.map((item: ReceiptItem, idx: number) => (
                        <div
                            key={idx}
                            className={`flex justify-between py-2.5 ${idx === receipt.items.length - 1 ? "" : "border-b border-white/5"}`}
                        >
                            <div className="flex-1">
                                <div className="text-sm text-slate-200 font-medium flex items-center gap-2">
                                    {item.normalized_name || item.name}
                                    {item.category && (
                                        <span className="text-[0.65rem] bg-white/10 px-1.5 py-px rounded text-slate-400 font-normal">
                                            {item.category}
                                        </span>
                                    )}
                                </div>
                                <div className={`text-xs text-slate-500 ${item.normalized_name ? "italic" : "not-italic"}`}>
                                    {item.normalized_name
                                        ? item.name
                                        : `${item.quantity} x R$ ${formatBRL(item.price)}`}
                                </div>
                                {item.normalized_name && (
                                    <div className="text-xs text-slate-400">
                                        {item.quantity} x R$ {formatBRL(item.price)}
                                    </div>
                                )}
                            </div>
                            <div className="text-slate-300 font-semibold text-sm">
                                R$ {item.total}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
});
