import { Edit3, X, Save, Plus } from "lucide-react";
import { formatBRL } from "../../../utils/currency";
import type { ReceiptItem } from "../../../types/domain";
import type { ManualReceiptFormProps } from "../../../types/scanner";

export function ManualReceiptForm({
  manualData,
  setManualData,
  manualItem,
  setManualItem,
  onAddManualItem,
  onSaveManualReceipt,
  onCancel,
  calculateReceiptTotal,
}: ManualReceiptFormProps) {
  return (
    <div className="glass-card">
      <div className="flex justify-between items-center mb-6 pb-4 border-b border-[var(--card-border)]">
        <h2 className="text-white flex items-center gap-2.5 text-[1.4rem]">
          <Edit3 color="var(--primary)" size={24} />
          Cadastro Manual
        </h2>
        <button onClick={onCancel} className="bg-white/5 border-none text-slate-400 cursor-pointer rounded-full w-9 h-9 flex items-center justify-center">
          <X size={20} />
        </button>
      </div>

      <div className="flex flex-col gap-3 mb-6">
        <input
          type="text"
          className="search-input"
          placeholder="Nome do Mercado"
          value={manualData.establishment}
          onChange={(e) => setManualData({ ...manualData, establishment: e.target.value })}
        />
        <input
          type="text"
          className="search-input"
          placeholder="Data (DD/MM/AAAA)"
          value={manualData.date}
          onChange={(e) => setManualData({ ...manualData, date: e.target.value })}
        />
      </div>

      <div className="bg-slate-900/40 p-5 rounded-2xl mb-6 border border-[var(--card-border)]">
        <h3 className="text-slate-200 mb-4 text-sm font-semibold uppercase">ADICIONAR ITEM</h3>
        <div className="flex flex-col gap-3">
          <input
            type="text"
            className="search-input bg-[var(--bg-color)]"
            placeholder="Nome do Produto"
            value={manualItem.name}
            onChange={(e) => setManualItem({ ...manualItem, name: e.target.value })}
          />
          <div className="flex gap-3">
            <input
              type="number"
              className="search-input w-[85px] bg-[var(--bg-color)]"
              placeholder="Qtd"
              value={manualItem.qty}
              onChange={(e) => setManualItem({ ...manualItem, qty: e.target.value })}
            />
            <input
              type="text"
              className="search-input flex-1 bg-[var(--bg-color)]"
              placeholder="Valor (ex: 5,90)"
              value={manualItem.unitPrice}
              onChange={(e) => setManualItem({ ...manualItem, unitPrice: e.target.value })}
            />
            <button
              className="btn px-5"
              onClick={onAddManualItem}
            >
              <Plus size={20} />
            </button>
          </div>
        </div>
      </div>

      {manualData.items.length > 0 && (
        <div
          className="items-list mb-6 max-h-[300px] overflow-y-auto"
        >
          {manualData.items.map((it: ReceiptItem, idx: number) => (
            <div
              key={idx}
              className="item-row p-3 bg-white/[0.03]"
            >
              <div className="item-details">
                <span className="item-name text-[0.95rem]">
                  {it.name}
                </span>
                <span className="item-meta">
                  {it.quantity} x R$ {formatBRL(it.price)}
                </span>
              </div>
              <div className="item-total text-[1.1rem]">
                R$ {it.total}
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        className="btn btn-success w-full p-4 text-[1.1rem]"
        onClick={onSaveManualReceipt}
        disabled={manualData.items.length === 0}
      >
        <Save size={20} />
        Finalizar e Salvar
      </button>

      {manualData.items.length > 0 && (
        <div className="mt-4 text-center">
          <p className="text-slate-400 text-[0.85rem]">
            Total: R$ {formatBRL(calculateReceiptTotal(manualData.items))}
          </p>
        </div>
      )}
    </div>
  );
}
