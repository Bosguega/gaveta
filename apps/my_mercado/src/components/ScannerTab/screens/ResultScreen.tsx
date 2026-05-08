import { CheckCircle, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { formatBRL, parseBRL } from "../../../utils/currency";
import { formatToBR } from "../../../utils/date";
import type { ReceiptItem } from "../../../types/domain";
import type { ReceiptResultProps } from "../../../types/scanner";

export function ResultScreen({ currentReceipt, onReset, calculateReceiptTotal }: ReceiptResultProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const displayDate = formatToBR(currentReceipt.date) || currentReceipt.date;

  const formatItemTotal = (item: ReceiptItem) => {
    if (item.total) return formatBRL(item.total);
    const price = parseBRL(item.price || 0);
    const quantity = parseBRL(item.quantity || 1);
    return formatBRL(price * quantity);
  };

  const total = calculateReceiptTotal(currentReceipt.items);

  return (
    <div className="glass-card p-0 overflow-hidden">
      {/* Header com ícone de sucesso */}
      <div className="bg-emerald-500/10 p-6 text-center border-b border-emerald-500/20">
        <div className="w-[60px] h-[60px] rounded-full bg-[var(--success)] flex items-center justify-center mx-auto mb-4">
          <CheckCircle color="white" size={32} />
        </div>
        <h2 className="text-white mb-2">Nota Escaneada!</h2>
        <p className="text-slate-400 text-sm">
          Revise os itens abaixo e confirme
        </p>
      </div>

      {/* Corpo do ReceiptCard (mesmo formato do histórico) */}
      <div>
        {/* Header do card */}
        <div
          onClick={() => setIsExpanded(!isExpanded)}
          className={`p-5 cursor-pointer ${isExpanded ? "border-b border-white/5" : ""}`}
        >
          <div className="flex justify-between items-start mb-2">
            <div>
              <h3 className="text-slate-50 text-[1.1rem] mb-1">
                {currentReceipt.establishment}
              </h3>
              <div className="flex gap-4 items-center">
                <span className="text-slate-400 text-xs">
                  {displayDate}
                </span>
                <span className="bg-blue-500/20 text-[var(--primary)] px-2 py-0.5 rounded-full text-xs">
                  {currentReceipt.items.length} itens
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[var(--success)] font-bold text-[1.1rem] whitespace-nowrap">
                R$ {total.toFixed(2).replace(".", ",")}
              </span>
            </div>
          </div>

          <div className="flex justify-center mt-2 text-slate-500">
            {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </div>
        </div>

        {/* Lista de itens expandida */}
        {isExpanded && (
          <div className="bg-slate-900/30 p-4 max-h-[300px] overflow-y-auto">
            {currentReceipt.items.map((item: ReceiptItem, idx: number) => (
              <div
                key={idx}
                className={`flex justify-between py-2.5 ${idx === currentReceipt.items.length - 1 ? "" : "border-b border-white/5"}`}
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
                      ? `${item.quantity} x R$ ${formatBRL(item.price)}`
                      : `${item.quantity} x R$ ${formatBRL(item.price)}`}
                  </div>
                </div>
                <div className="text-slate-300 font-semibold text-sm">
                  R$ {formatItemTotal(item)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Total e Botões de ação */}
      <div className="p-5 border-t border-white/5 bg-slate-900/30">
        <div className="total-summary flex justify-between items-center mb-4 text-xl">
          <span className="text-slate-400 font-medium">Total da Nota</span>
          <span className="text-[var(--success)] font-bold">
            R$ {total.toFixed(2).replace(".", ",")}
          </span>
        </div>

        <button
          className="btn btn-success w-full p-4 text-base font-semibold"
          onClick={onReset}
        >
          <CheckCircle size={20} />
          Confirmar e Concluir
        </button>
      </div>
    </div>
  );
}
