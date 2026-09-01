import { useEffect, useId, useMemo, useCallback, useState } from "react";
import { X } from "lucide-react";
import { formatBRL, parseBRL } from "../utils/currency";
import { formatQuantity } from "../utils/format";
import type { ReceiptItem } from "../types/domain";

type PriceEditModalProps = {
  item: ReceiptItem;
  isOpen: boolean;
  busy?: boolean;
  onCancel: () => void;
  onSavePaidPrice: (paidPrice: number) => void;
};

type EditedField = "paidPrice" | "total";

/**
 * Creates a key-down handler for an input that saves on Enter and cancels on Escape.
 */
function useInputKeyDown(handler: () => void, cancel: () => void, disabled: boolean) {
  return useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "Enter" && !disabled) {
        event.preventDefault();
        handler();
      }
      if (event.key === "Escape") {
        event.preventDefault();
        cancel();
      }
    },
    [handler, cancel, disabled]
  );
}

export function PriceEditModal({
  item,
  isOpen,
  busy = false,
  onCancel,
  onSavePaidPrice,
}: PriceEditModalProps) {
  const paidPriceInputId = useId();
  const totalInputId = useId();
  const quantity = item.quantity || 1;
  const unit = item.unit || "un";
  const originalTotal = item.total ?? item.price * quantity;
  const currentPaidPrice = item.paid_price ?? item.price;
  const currentPaidTotal = currentPaidPrice * quantity;
  const productName = item.normalized_name || item.name;

  const [paidPriceValue, setPaidPriceValue] = useState(formatBRL(currentPaidPrice));
  const [totalValue, setTotalValue] = useState(formatBRL(currentPaidTotal));
  const [editedField, setEditedField] = useState<EditedField>("paidPrice");

  // Reset state whenever modal opens or item changes
  useEffect(() => {
    if (!isOpen) return;
    setPaidPriceValue(formatBRL(currentPaidPrice));
    setTotalValue(formatBRL(currentPaidTotal));
    setEditedField("paidPrice");
  }, [isOpen, currentPaidPrice, currentPaidTotal]);

  // --- Synchronisation helpers ---
  const handlePaidPriceChange = useCallback(
    (raw: string) => {
      setEditedField("paidPrice");
      setPaidPriceValue(raw);
      const parsed = parseBRL(raw);
      if (Number.isFinite(parsed) && raw.trim() !== "") {
        // If negative, user is providing a discount value to subtract from original
        const effectivePrice = parsed < 0 ? item.price + parsed : parsed;
        if (effectivePrice >= 0) {
          setTotalValue(formatBRL(effectivePrice * quantity));
        }
      }
    },
    [quantity, item.price]
  );

  const handleTotalChange = useCallback(
    (raw: string) => {
      setEditedField("total");
      setTotalValue(raw);
      const parsed = parseBRL(raw);
      if (Number.isFinite(parsed) && raw.trim() !== "") {
        // If negative, user is providing a discount value to subtract from original total
        const effectiveTotal = parsed < 0 ? originalTotal + parsed : parsed;
        if (effectiveTotal >= 0) {
          setPaidPriceValue(formatBRL(effectiveTotal / quantity));
        }
      }
    },
    [quantity, originalTotal]
  );

  // Derived value to be saved (unit price)
  const nextPaidPrice = useMemo(() => {
    if (editedField === "total") {
      const parsed = parseBRL(totalValue);
      // If negative, user is providing a discount on the original total
      const effectiveTotal = parsed < 0 ? originalTotal + parsed : parsed;
      return effectiveTotal / quantity;
    }
    const parsed = parseBRL(paidPriceValue);
    // If negative, user is providing a discount on the original unit price
    return parsed < 0 ? item.price + parsed : parsed;
  }, [editedField, paidPriceValue, item.price, quantity, totalValue, originalTotal]);

  // Check if the field currently being edited is empty (whitespace-only)
  const isEditedFieldEmpty = useMemo(() => {
    if (editedField === "paidPrice") return paidPriceValue.trim() === "";
    return totalValue.trim() === "";
  }, [editedField, paidPriceValue, totalValue]);

  const isInvalid = isEditedFieldEmpty || !Number.isFinite(nextPaidPrice) || nextPaidPrice < 0;

  // Visual preview values (recalculated in real-time, always showing effective values)
  const previewPaidUnit = nextPaidPrice;
  const previewPaidTotal = nextPaidPrice * quantity;

  const handleSave = useCallback(() => {
    onSavePaidPrice(nextPaidPrice);
  }, [onSavePaidPrice, nextPaidPrice]);

  const paidPriceKeyDown = useInputKeyDown(handleSave, onCancel, busy || isInvalid);
  const totalKeyDown = useInputKeyDown(handleSave, onCancel, busy || isInvalid);

  if (!isOpen) return null;

  return (
    <div className="duplicate-modal-overlay z-[4600]" onClick={onCancel}>
      <div
        className="glass-card duplicate-modal-card"
        style={{ maxWidth: "420px" }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            <h3 className="text-white text-lg font-semibold mb-1">Editar preço</h3>
            <p className="text-slate-300 text-sm font-medium truncate">{productName}</p>
            <p className="text-slate-500 text-xs">
              {formatQuantity(quantity)} {unit}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 inline-flex items-center justify-center flex-shrink-0"
            aria-label="Fechar"
          >
            <X size={16} />
          </button>
        </div>

        {/* Original values */}
        <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
          <div className="rounded-lg bg-slate-900/40 border border-white/10 p-3">
            <div className="text-slate-500 text-xs mb-1">Preço original /{unit}</div>
            <div className="text-slate-100 font-semibold">{formatBRL(item.price)}</div>
          </div>
          <div className="rounded-lg bg-slate-900/40 border border-white/10 p-3">
            <div className="text-slate-500 text-xs mb-1">Total original</div>
            <div className="text-slate-100 font-semibold">{formatBRL(originalTotal)}</div>
          </div>
        </div>

        {/* Editable fields */}
        <div className="space-y-3 mb-4">
          <div>
            <label htmlFor={paidPriceInputId} className="block text-slate-400 text-xs mb-1">
              Preço pago /{unit}
            </label>
            <input
              id={paidPriceInputId}
              className="search-input text-right"
              inputMode="decimal"
              value={paidPriceValue}
              autoFocus
              onChange={(event) => handlePaidPriceChange(event.target.value)}
              onKeyDown={paidPriceKeyDown}
            />
          </div>

          <div>
            <label htmlFor={totalInputId} className="block text-slate-400 text-xs mb-1">
              Total pago
            </label>
            <input
              id={totalInputId}
              className="search-input text-right"
              inputMode="decimal"
              value={totalValue}
              onChange={(event) => handleTotalChange(event.target.value)}
              onKeyDown={totalKeyDown}
            />
          </div>
        </div>

        {/* Live preview summary */}
        <div className="rounded-lg bg-slate-800/50 border border-white/5 p-3 mb-4 text-sm">
          <div className="text-slate-400 text-xs mb-2 font-medium uppercase tracking-wider">
            Resumo
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between">
              <span className="text-slate-400">Preço /{unit}</span>
              <span className="text-slate-200">
                <span className="line-through text-slate-500 mr-1.5">{formatBRL(item.price)}</span>
                <span className="text-[var(--success)] font-semibold">
                  {Number.isFinite(previewPaidUnit) ? formatBRL(previewPaidUnit) : "—"}
                </span>
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Total</span>
              <span className="text-slate-200">
                <span className="line-through text-slate-500 mr-1.5">{formatBRL(originalTotal)}</span>
                <span className="text-[var(--success)] font-semibold">
                  {Number.isFinite(previewPaidTotal) ? formatBRL(previewPaidTotal) : "—"}
                </span>
              </span>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="btn bg-white/5 border border-[var(--card-border)]"
          >
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-success"
            onClick={handleSave}
            disabled={busy || isInvalid}
          >
            {busy ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}