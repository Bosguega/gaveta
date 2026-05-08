import { formatBRL } from "../../utils/currency";
import type { SummaryCardProps } from "./HistoryTab.types";

export function SummaryCard({ totalSpent, filteredCount }: SummaryCardProps) {
  return (
    <div className="glass-card p-5 mb-4 flex justify-between items-center border border-blue-500/20 bg-gradient-to-br from-blue-500/10 to-emerald-500/10">
      <div>
        <p className="text-slate-400 text-[0.85rem] mb-1">
          Total gasto no período
        </p>
        <h3 className="text-white text-[1.8rem] font-extrabold">
          R$ {formatBRL(totalSpent)}
        </h3>
      </div>
      <div className="text-right">
        <p className="text-slate-400 text-[0.85rem] mb-1">
          Notas Filtradas
        </p>
        <h4 className="text-[var(--primary)] text-[1.2rem] font-bold">
          {filteredCount}
        </h4>
      </div>
    </div>
  );
}
