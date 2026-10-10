import { useEffect, useId, useMemo, useState } from "react";
import { X } from "lucide-react";
import { formatBRL, parseBRL } from "../utils/currency";
import type { ReceiptItem } from "../types/domain";

export interface ItemEditChanges {
  name: string;
  quantity: number;
  price: number;
}

type ItemEditModalProps = {
  item: ReceiptItem;
  isOpen: boolean;
  busy?: boolean;
  onCancel: () => void;
  onSave: (changes: ItemEditChanges) => void;
};

function formatQuantityInput(value: number): string {
  return String(value).replace(".", ",");
}

/**
 * Modal de edição completa de um item extraído (nome, quantidade e preço
 * unitário cheio). Usado exclusivamente no fluxo da galeria para corrigir
 * erros do scrap. O desconto por item (paid_price) continua sendo ajustado
 * pelo PriceEditModal; aqui apenas garantimos que os valores cheios fiquem
 * corretos e recalculamos o total derivado.
 */
export function ItemEditModal({
  item,
  isOpen,
  busy = false,
  onCancel,
  onSave,
}: ItemEditModalProps) {
  const nameId = useId();
  const quantityId = useId();
  const priceId = useId();

  const unit = item.unit || "un";

  const [name, setName] = useState(item.name);
  const [quantity, setQuantity] = useState(formatQuantityInput(item.quantity || 1));
  const [price, setPrice] = useState(formatBRL(item.price || 0));

  useEffect(() => {
    if (!isOpen) return;
    setName(item.name);
    setQuantity(formatQuantityInput(item.quantity || 1));
    setPrice(formatBRL(item.price || 0));
  }, [isOpen, item.name, item.quantity, item.price]);

  const parsedQuantity = useMemo(() => {
    const parsed = parseFloat(quantity.replace(",", "."));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : NaN;
  }, [quantity]);

  const parsedPrice = useMemo(() => parseBRL(price), [price]);

  const isInvalid =
    name.trim() === "" || !Number.isFinite(parsedQuantity) || parsedQuantity <= 0 || !Number.isFinite(parsedPrice) || parsedPrice < 0;

  const previewTotal = Number.isFinite(parsedQuantity) && Number.isFinite(parsedPrice)
    ? parsedQuantity * parsedPrice
    : NaN;

  const handleSave = () => {
    if (isInvalid) return;
    onSave({ name: name.trim(), quantity: parsedQuantity, price: parsedPrice });
  };

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
            <h3 className="text-white text-lg font-semibold mb-1">Editar item</h3>
            <p className="text-slate-500 text-xs">Corrija os dados extraídos da imagem</p>
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

        <div className="space-y-3 mb-4">
          <div>
            <label htmlFor={nameId} className="block text-slate-400 text-xs mb-1">
              Nome do produto
            </label>
            <input
              id={nameId}
              className="search-input"
              value={name}
              autoFocus
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !busy && !isInvalid) {
                  event.preventDefault();
                  handleSave();
                }
                if (event.key === "Escape") {
                  event.preventDefault();
                  onCancel();
                }
              }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor={quantityId} className="block text-slate-400 text-xs mb-1">
                Quantidade
              </label>
              <input
                id={quantityId}
                className="search-input text-right"
                inputMode="decimal"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
              />
            </div>
            <div>
              <label htmlFor={priceId} className="block text-slate-400 text-xs mb-1">
                Preço /{unit}
              </label>
              <input
                id={priceId}
                className="search-input text-right"
                inputMode="decimal"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-slate-800/50 border border-white/5 p-3 mb-4 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-400">Total (cheio)</span>
            <span className="text-slate-200 font-semibold">
              {Number.isFinite(previewTotal) ? formatBRL(previewTotal) : "—"}
            </span>
          </div>
        </div>

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
