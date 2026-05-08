import { ArrowRightLeft, CheckCircle2, Circle, Copy, ReceiptText, Trash2 } from "lucide-react";
import { formatBRL } from "../utils/currency";
import { formatToBR } from "../utils/date";
import type { ShoppingListItem } from "../types/ui";
import type { PurchaseHistoryEntry } from "../hooks/queries/usePurchaseHistory";

type ShoppingListItemProps = {
  item: ShoppingListItem;
  history: PurchaseHistoryEntry[];
  historyMatchType?: "exact" | "approx" | "none";
  onToggle: () => void;
  onRemove: () => void;
  transferOptions?: Array<{ id: string; name: string }>;
  transferTargetId?: string;
  onTransferTargetChange?: (targetListId: string) => void;
  onMoveToList?: () => void;
  onCopyToList?: () => void;
  currentUserId?: string | null;
};

export function ShoppingListItem({
  item,
  history,
  historyMatchType = "none",
  onToggle,
  onRemove,
  transferOptions = [],
  transferTargetId = "",
  onTransferTargetChange,
  onMoveToList,
  onCopyToList,
  currentUserId,
}: ShoppingListItemProps) {
  const latest = history[0];
  const avgPrice =
    history.length > 0
      ? history.reduce((acc, entry) => acc + entry.unitPrice, 0) / history.length
      : 0;

  return (
    <div
      className={`glass-card animated-item p-4 mb-0 ${item.checked ? "border-emerald-500/30 opacity-75" : "border-[var(--card-border)] opacity-100"}`}
    >
      <div className="flex gap-3 items-start">
        <button
          onClick={onToggle}
          className={`bg-transparent border-none p-0 cursor-pointer mt-1 ${item.checked ? "text-[var(--success)]" : "text-slate-500"}`}
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

          {item.checked && item.checked_by_user_id && (
            <p className="text-slate-400 text-[0.76rem] mt-1">
              Marcado por{" "}
              {item.checked_by_user_id === currentUserId
                ? "voce"
                : `${item.checked_by_user_id.slice(0, 8)}...`}
            </p>
          )}

          {transferOptions.length > 0 && (
            <div className="shopping-transfer-row mt-2">
              <select
                value={transferTargetId}
                onChange={(event) => onTransferTargetChange?.(event.target.value)}
                aria-label="Selecionar lista destino"
                className="search-input min-h-[34px] px-2 py-1"
              >
                {transferOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
              <button
                onClick={onCopyToList}
                className="bg-blue-500/15 border-none h-8 rounded-lg text-blue-300 px-2.5 inline-flex items-center gap-1 cursor-pointer hover:bg-blue-500/25 text-sm"
                title="Copiar para lista selecionada"
                aria-label="Copiar item para lista selecionada"
              >
                <Copy size={13} /> Copiar
              </button>
              <button
                onClick={onMoveToList}
                className="bg-green-500/15 border-none h-8 rounded-lg text-green-300 px-2.5 inline-flex items-center gap-1 cursor-pointer hover:bg-green-500/25 text-sm"
                title="Mover para lista selecionada"
                aria-label="Mover item para lista selecionada"
              >
                <ArrowRightLeft size={13} /> Mover
              </button>
            </div>
          )}

          <div className="mt-2.5 p-3 rounded-xl bg-slate-900/45 border border-white/5">
            <div className="flex items-center justify-between gap-2.5 mb-1.5 text-slate-400 text-[0.76rem] font-semibold uppercase">
              <span className="inline-flex items-center gap-1.5">
                <ReceiptText size={14} />
                Ultimas Compras
              </span>
              {historyMatchType !== "none" && (
                <span
                  className={`text-[0.68rem] normal-case rounded-full px-2 py-0.5 border ${historyMatchType === "exact" ? "border-green-500/45 bg-green-500/20 text-green-300" : "border-yellow-500/45 bg-yellow-500/15 text-yellow-200"}`}
                  title={
                    historyMatchType === "exact"
                      ? "Historico encontrado por chave exata"
                      : "Historico encontrado por aproximacao"
                  }
                >
                  {historyMatchType === "exact" ? "Exato" : "Aproximado"}
                </span>
              )}
            </div>

            {latest ? (
              <>
                <p className="text-slate-200 text-[0.85rem]">
                  {formatToBR(latest.date, false)} em {latest.store} por R${" "}
                  {formatBRL(latest.unitPrice)}
                  /un
                </p>
                <p className="text-slate-500 text-[0.78rem] mt-1">
                  Media recente: R$ {formatBRL(avgPrice)} / un
                </p>

                <div className="flex flex-wrap gap-1.5 mt-2">
                  {history.map((entry, idx) => (
                    <span
                      key={`${entry.key}_${entry.timestamp}_${idx}`}
                      className="text-[0.72rem] text-blue-300 border border-blue-500/30 bg-blue-500/10 rounded-full px-2 py-0.5"
                    >
                      {formatToBR(entry.date, false)}: R$ {formatBRL(entry.unitPrice)}
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-slate-500 text-[0.82rem]">
                Ainda sem historico de compra para este item.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
