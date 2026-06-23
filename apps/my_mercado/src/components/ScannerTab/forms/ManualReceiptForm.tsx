import { Edit3, X, Plus, Trash2, ShoppingCart } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { formatBRL } from "../../../utils/currency";
import type { ReceiptItem } from "../../../types/domain";
import type { ManualReceiptFormProps } from "../../../types/scanner";

/**
 * Converte data BR (DD/MM/AAAA) para formato ISO (AAAA-MM-DD) para usar em input[type=date]
 */
function brDateToIso(br: string): string {
  const match = br.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (!match) return new Date().toISOString().split("T")[0];
  const [, dd, mm, yyyy] = match;
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Converte data ISO (AAAA-MM-DD) para formato BR (DD/MM/AAAA)
 */
function isoToBrDate(iso: string): string {
  if (!iso) return "";
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return iso;
  const [, yyyy, mm, dd] = match;
  return `${dd}/${mm}/${yyyy}`;
}

export function ManualReceiptForm({
  manualData,
  setManualData,
  manualItem,
  setManualItem,
  onAddManualItem,
  onRemoveManualItem,
  onSaveManualReceipt,
  onCancel,
  calculateReceiptTotal,
  productSuggestions,
  establishmentOptions,
}: ManualReceiptFormProps) {
  const total = useMemo(
    () => calculateReceiptTotal(manualData.items),
    [manualData.items, calculateReceiptTotal]
  );
  const itemsCount = manualData.items.length;

  const [showCustomEstablishment, setShowCustomEstablishment] = useState(
    !establishmentOptions || establishmentOptions.length === 0
  );
  const itemsListRef = useRef<HTMLDivElement>(null);

  const dateIso = useMemo(
    () => brDateToIso(manualData.date),
    [manualData.date]
  );

  const handleDateChange = (iso: string) => {
    setManualData({ ...manualData, date: isoToBrDate(iso) });
  };

  const handleEstablishmentSelect = (selected: string) => {
    if (selected === "__custom__") {
      setShowCustomEstablishment(true);
      setManualData({ ...manualData, establishment: "" });
    } else {
      setShowCustomEstablishment(false);
      setManualData({ ...manualData, establishment: selected });
    }
  };

  return (
    <div className="glass-card">
      {/* Header */}
      <div className="flex justify-between items-center mb-6 pb-4 border-b border-[var(--card-border)]">
        <h2 className="text-white flex items-center gap-2.5 text-[1.4rem]">
          <Edit3 color="var(--primary)" size={24} />
          Cadastro Manual
        </h2>
        <button
          onClick={onCancel}
          className="bg-white/5 border-none text-slate-400 cursor-pointer rounded-full w-9 h-9 flex items-center justify-center hover:bg-white/10 transition-colors"
          title="Cancelar"
        >
          <X size={20} />
        </button>
      </div>

      {/* Dados da Nota */}
      <div className="flex flex-col gap-3 mb-5">
        {/* Seletor de Mercado */}
        {establishmentOptions && establishmentOptions.length > 0 && (
          <div>
            <label className="block text-slate-500 text-[0.7rem] uppercase tracking-wide mb-1 font-semibold">
              Mercado
            </label>
            <select
              className="search-input"
              value={
                showCustomEstablishment || !manualData.establishment
                  ? "__custom__"
                  : manualData.establishment
              }
              onChange={(e) => handleEstablishmentSelect(e.target.value)}
            >
              <option value="" disabled>
                Selecione um mercado
              </option>
              {establishmentOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
              <option value="__custom__">➕ Outro...</option>
            </select>
          </div>
        )}

        {/* Input customizado de mercado (sempre visível se não houver opções, ou se "Outro..." for selecionado) */}
        {(showCustomEstablishment || !establishmentOptions || establishmentOptions.length === 0) && (
          <input
            type="text"
            className="search-input"
            placeholder="Nome do Mercado"
            value={manualData.establishment}
            onChange={(e) =>
              setManualData({ ...manualData, establishment: e.target.value })
            }
          />
        )}

        <div className="relative">
          <input
            type="date"
            className="search-input"
            value={dateIso}
            onChange={(e) => handleDateChange(e.target.value)}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none text-xs">
            Data da compra
          </span>
        </div>
      </div>

      {/* Adicionar Item */}
      <div className="bg-[var(--card-bg)]/60 p-4 rounded-2xl mb-5 border border-[var(--card-border)]">
        <h3 className="text-slate-300 mb-3 text-sm font-semibold flex items-center gap-2">
          <ShoppingCart size={16} className="text-[var(--primary)]" />
          NOVO ITEM
        </h3>
        <div className="flex flex-col gap-3">
          {/* Nome do Produto */}
          <div>
            <label className="block text-slate-500 text-[0.7rem] uppercase tracking-wide mb-1 font-semibold">
              Produto
            </label>
            <input
              type="text"
              className="search-input bg-[var(--bg-color)]"
              placeholder="Ex: Arroz Integral"
              value={manualItem.name}
              onChange={(e) =>
                setManualItem({ ...manualItem, name: e.target.value })
              }
              list="product-suggestions"
            />
            {productSuggestions && productSuggestions.length > 0 && (
              <datalist id="product-suggestions">
                {productSuggestions.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            )}
          </div>
          {/* Qtd, Preço e Botão */}
          <div className="flex gap-3 items-end">
            {/* Quantidade */}
            <div className="w-[90px] flex-shrink-0">
              <label className="block text-slate-500 text-[0.7rem] uppercase tracking-wide mb-1 font-semibold">
                Qtd
              </label>
              <input
                type="number"
                className="search-input bg-[var(--bg-color)] text-center"
                placeholder="1"
                value={manualItem.qty}
                onChange={(e) =>
                  setManualItem({ ...manualItem, qty: e.target.value })
                }
                min="0.5"
                step="0.5"
                inputMode="decimal"
              />
            </div>
            {/* Preço Unitário */}
            <div className="flex-1 min-w-0">
              <label className="block text-slate-500 text-[0.7rem] uppercase tracking-wide mb-1 font-semibold">
                Preço unitário (R$)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-400 font-semibold text-sm pointer-events-none z-10 w-5 text-center">
                  R$
                </span>
                <input
                  type="text"
                  className="search-input bg-[var(--bg-color)] pl-12"
                  placeholder="0,00"
                  value={manualItem.unitPrice}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^\d,.]/g, "");
                    setManualItem({ ...manualItem, unitPrice: val });
                  }}
                  inputMode="decimal"
                />
              </div>
            </div>
            {/* Botão Adicionar */}
            <button
              className="btn px-5 h-[44px] flex-shrink-0 mb-[2px]"
              onClick={onAddManualItem}
              title="Adicionar item"
            >
              <Plus size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* Lista de Itens */}
      {itemsCount > 0 && (
        <div className="mb-5">
          <div className="flex justify-between items-center mb-2 px-1">
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wide">
              Itens adicionados ({itemsCount})
            </span>
          </div>
          <div
            ref={itemsListRef}
            className="max-h-[280px] overflow-y-auto space-y-2"
          >
            {manualData.items.map((it: ReceiptItem, idx: number) => (
              <div
                key={`${it.name}-${idx}`}
                className="item-row py-2.5 px-3 bg-white/[0.03] flex items-center gap-2 animate-fadeIn"
                style={{ animationDelay: `${idx * 30}ms` }}
              >
                <div className="item-details flex-1 min-w-0">
                  <span className="item-name text-[0.95rem] truncate">
                    {it.name}
                  </span>
                  <span className="item-meta text-xs">
                    {it.quantity} x R$ {formatBRL(it.price)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[var(--success)] font-semibold text-sm whitespace-nowrap">
                    R$ {formatBRL(it.total ?? it.quantity * it.price)}
                  </span>
                  <button
                    onClick={() => onRemoveManualItem(idx)}
                    className="bg-red-500/10 border-none rounded w-7 h-7 flex items-center justify-center text-red-400 cursor-pointer hover:bg-red-500/20 hover:text-red-300 transition-colors flex-shrink-0"
                    title="Remover item"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Total */}
      {itemsCount > 0 && (
        <div className="total-summary mb-4 text-base">
          <span className="text-slate-300">Total da Nota</span>
          <span className="text-[var(--success)] font-bold text-lg">
            R$ {formatBRL(total)}
          </span>
        </div>
      )}

      {/* Botão Finalizar */}
      <button
        className="btn btn-success w-full p-4 text-[1.1rem] disabled:opacity-50 disabled:cursor-not-allowed"
        onClick={onSaveManualReceipt}
        disabled={itemsCount === 0}
      >
        <Edit3 size={20} />
        {itemsCount === 0 ? "Adicione itens para finalizar" : "Finalizar"}
      </button>
    </div>
  );
}