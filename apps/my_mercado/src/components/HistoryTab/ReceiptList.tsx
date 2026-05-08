import { ReceiptCard } from "../ReceiptCard";
import { ReceiptSkeleton } from "../Skeleton";
import type { ReceiptListProps } from "./HistoryTab.types";

export function ReceiptList({
  receipts,
  expandedReceipts,
  isLoading,
  onToggleExpand,
  onDelete,
  isEmpty,
  hasNoResults,
}: ReceiptListProps) {
  if (isLoading) {
    return (
      <div className="items-list gap-5">
        {[...Array(3)].map((_, i) => (
          <ReceiptSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (isEmpty) {
    return null; // EmptyState é renderizado separadamente
  }

  if (hasNoResults) {
    return (
      <div className="glass-card text-center py-12 px-4">
        <h3 className="text-slate-200 mt-4">
          Nenhuma nota encontrada
        </h3>
        <p className="text-slate-400 mt-2">
          Tente buscar por outro termo ou mercado.
        </p>
      </div>
    );
  }

  return (
    <div className="items-list gap-4">
      {receipts.map((receipt) => (
        <ReceiptCard
          key={receipt.id}
          receipt={receipt}
          isExpanded={expandedReceipts.includes(receipt.id)}
          onToggle={onToggleExpand}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
