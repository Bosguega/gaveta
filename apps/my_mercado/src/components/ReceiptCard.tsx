import React, { useMemo, useCallback, useState, useRef, useEffect } from "react";
import { Trash2, ChevronDown, ChevronUp, Edit3, Pencil } from "lucide-react";
import { parseBRL, formatBRL } from "../utils/currency";
import { calculateReceiptTotal } from "../utils/analytics";
import { formatToBR } from "../utils/date";
import type { Receipt, ReceiptItem } from "../types/domain";
import { useEstablishmentPrefillStore } from "../stores/useEstablishmentPrefillStore";
import { useUiStore } from "../stores/useUiStore";
import { useUpdateItemPaidPrice } from "../hooks/queries/useUpdateItemPaidPrice";

interface ReceiptCardProps {
    receipt: Receipt;
    isExpanded: boolean;
    onToggle: (id: string) => void;
    onDelete: (id: string) => void;
}

interface EditablePriceProps {
    item: ReceiptItem;
}

const EditablePrice = React.memo(function EditablePrice({ item }: EditablePriceProps) {
    const [editing, setEditing] = useState(false);
    const [value, setValue] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);
    const updatePaidPrice = useUpdateItemPaidPrice();

    const paidPrice = item.paid_price ?? item.price;
    const hasDiscount = item.paid_price !== undefined && item.paid_price < item.price;
    const itemTotal = item.total ?? (item.price * item.quantity);

    const displayPrice = useMemo(() => {
        if (hasDiscount) {
            return paidPrice * item.quantity;
        }
        return itemTotal;
    }, [hasDiscount, paidPrice, item.quantity, itemTotal]);

    const handleStartEdit = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        setValue(formatBRL(item.paid_price ?? item.price));
        setEditing(true);
    }, [item.paid_price, item.price]);

    useEffect(() => {
        if (editing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [editing]);

    const handleFinishEdit = useCallback(() => {
        setEditing(false);
        const parsed = parseBRL(value);
        if (isNaN(parsed) || parsed < 0) return;
        // Só salva se realmente mudou
        if (parsed === (item.paid_price ?? item.price)) return;
        if (!item.id) return;

        updatePaidPrice.mutate({ itemId: item.id, paidPrice: parsed });
    }, [value, item.paid_price, item.price, item.id, updatePaidPrice]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            (e.target as HTMLInputElement).blur();
        }
        if (e.key === "Escape") {
            setEditing(false);
        }
        e.stopPropagation();
    }, []);

    if (editing) {
        return (
            <input
                ref={inputRef}
                type="text"
                className="w-24 text-right bg-slate-800 border border-blue-500/40 rounded px-2 py-0.5 text-sm text-slate-200 outline-none focus:border-blue-500"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onBlur={handleFinishEdit}
                onKeyDown={handleKeyDown}
                onClick={(e) => e.stopPropagation()}
            />
        );
    }

    return (
        <div className="flex items-center gap-2">
            {hasDiscount ? (
                <div className="flex items-center gap-1.5">
                    <span className="text-slate-500 line-through text-xs">
                        R$ {itemTotal.toFixed(2).replace(".", ",")}
                    </span>
                    <span className="text-[var(--success)] font-semibold text-sm">
                        R$ {displayPrice.toFixed(2).replace(".", ",")}
                    </span>
                </div>
            ) : (
                <span className="text-slate-300 font-semibold text-sm">
                    R$ {itemTotal.toFixed(2).replace(".", ",")}
                </span>
            )}
            <button
                onClick={handleStartEdit}
                className="bg-slate-700/50 border-none rounded w-5 h-5 flex items-center justify-center text-slate-400 cursor-pointer hover:text-slate-200 hover:bg-slate-700 flex-shrink-0"
                title="Editar preço pago"
            >
                <Pencil size={10} />
            </button>
        </div>
    );
});

export const ReceiptCard = React.memo(function ReceiptCard({
    receipt,
    isExpanded,
    onToggle,
    onDelete,
}: ReceiptCardProps) {
    const setPrefillNomeNota = useEstablishmentPrefillStore((s) => s.setNomeNota);
    const setTab = useUiStore((s) => s.setTab);

    // Exibe establishment_display (sempre preenchido pela RPC)
    const displayEstablishment = useMemo(() => {
        return receipt.establishment_display || receipt.establishment;
    }, [receipt.establishment, receipt.establishment_display]);

    const handleGoToEstablishmentDictionary = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        setPrefillNomeNota(receipt.establishment);
        setTab("settings");
    }, [receipt.establishment, setPrefillNomeNota, setTab]);

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
                        <h3 className="text-slate-50 text-[1.1rem] mb-1 group">
                            {displayEstablishment}
                            <button
                                onClick={handleGoToEstablishmentDictionary}
                                className="ml-2 bg-blue-500/10 border-none rounded-lg w-6 h-6 inline-flex items-center justify-center text-[var(--primary)] align-middle opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Definir nome amigável"
                            >
                                <Edit3 size={12} />
                            </button>
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
                            key={item.id || idx}
                            className={`flex justify-between py-2.5 ${idx === receipt.items.length - 1 ? "" : "border-b border-white/5"}`}
                        >
                            <div className="flex-1 min-w-0">
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
                            <div className="flex-shrink-0 ml-2">
                                <EditablePrice item={item} />
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
});