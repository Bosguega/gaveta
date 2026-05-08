import React from "react";
import { Package } from "lucide-react";
import { parseBRL } from "../utils/currency";
import { formatToBR } from "../utils/date";
import type { PurchasedItem } from "../types/ui";

interface SearchItemRowProps {
  item: PurchasedItem & { canonical_name?: string };
}

export const SearchItemRow: React.FC<SearchItemRowProps> = ({ item }) => {
  return (
    <div className="item-row animated-item">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <div className="item-name">
            {item.canonical_name || item.normalized_name || item.name}
          </div>
          {item.canonical_product_id && (
            <span
              className="text-[0.65rem] bg-amber-500/10 px-1.5 py-0.5 rounded text-amber-500 flex items-center gap-1 font-bold"
            >
              <Package size={12} /> VIP
            </span>
          )}
          {item.category && (
            <span
              className="text-[0.65rem] bg-blue-500/10 px-1.5 py-0.5 rounded text-[var(--primary)]"
            >
              {item.category}
            </span>
          )}
        </div>
        {item.normalized_name && (
          <div className="text-xs text-slate-500 italic mb-1">
            {item.name}
          </div>
        )}
        <div className="flex gap-3 mt-1">
          <span className="text-xs text-[var(--primary)] font-medium">
            {item.store}
          </span>
          <span className="text-xs text-slate-600">
            {formatToBR(item.purchasedAt, false)}
          </span>
        </div>
      </div>
      <div className="text-right">
        <div className="text-[var(--success)] font-bold text-lg">
          R$ {parseBRL(item.price).toFixed(2).replace(".", ",")}
        </div>
        <div className="text-[0.7rem] text-slate-600">
          por {item.unit || "un."}
        </div>
      </div>
    </div>
  );
};
