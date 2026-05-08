import { Eraser, Trash2, Users } from "lucide-react";

interface CollaborativeHeaderProps {
  pendingCount: number;
  totalCount: number;
  checkedCount: number;
  onClearChecked: () => void;
  onClearAll: () => void;
}

export function CollaborativeHeader({
  pendingCount,
  totalCount,
  checkedCount,
  onClearChecked,
  onClearAll,
}: CollaborativeHeaderProps) {
  return (
    <div className="shopping-section-header">
      <div>
        <h2 className="section-title mb-1">
          <Users size={20} color="var(--primary)" />
          Lista de Compras Colaborativa
        </h2>
        <p className="text-[0.8rem] text-slate-500 ml-7">
          {pendingCount} pendente(s) de {totalCount}
        </p>
      </div>

      <div className="shopping-icon-actions">
        <button
          className="btn px-[0.6rem] py-[0.45rem] bg-amber-500/15 shadow-none text-amber-500 hover:bg-amber-500/25"
          title="Limpar marcados"
          aria-label="Limpar itens marcados"
          onClick={onClearChecked}
          disabled={checkedCount === 0}
        >
          <Eraser size={16} />
        </button>
        <button
          className="btn px-[0.6rem] py-[0.45rem] bg-red-500/15 shadow-none text-red-500 hover:bg-red-500/25"
          title="Limpar lista"
          aria-label="Limpar lista"
          onClick={onClearAll}
          disabled={totalCount === 0}
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}
