import React from "react";
import { Edit3, Trash2 } from "lucide-react";
import type { DictionaryEntry } from "../types/domain";
interface DictionaryRowProps {
  item: DictionaryEntry;
  onEdit: (item: DictionaryEntry) => void;
  onDelete: (key: string) => void;
}

export const DictionaryRow: React.FC<DictionaryRowProps> = ({
  item,
  onEdit,
  onDelete,
}) => {

  return (
    <div className="glass-card animated-item mb-0 p-4">
      <div className="flex justify-between items-center">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-white font-semibold">
              {item.normalized_name || "Sem nome"}
            </span>
            <span className="text-[0.65rem] bg-blue-500/10 px-1.5 py-[1px] rounded text-[var(--primary)]">
              {item.category || "Outros"}
            </span>
          </div>
          <div className="text-xs text-slate-500 italic">
            ID: {item.key}
          </div>

        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onEdit(item)}
            className="bg-blue-500/10 border-none rounded-lg w-9 h-9 flex items-center justify-center text-[var(--primary)]"
          >
            <Edit3 size={16} />
          </button>
          <button
            onClick={() => onDelete(item.key)}
            className="bg-red-500/10 border-none rounded-lg w-9 h-9 flex items-center justify-center text-red-500"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};
