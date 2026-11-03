import { History } from "lucide-react";
import { EmptyState as BaseEmptyState } from "../ui/EmptyState";

export function EmptyState() {
  return (
    <BaseEmptyState
      icon={
        <div className="relative inline-block">
          <History size={64} color="var(--primary)" className="opacity-20" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <History size={32} color="var(--primary)" />
          </div>
        </div>
      }
      title="Histórico vazio"
      description="Suas notas fiscais escaneadas aparecerão aqui para você acompanhar preços e economizar."
      className="glass-card text-center py-16 px-4"
    >
      <p className="text-[var(--primary)] text-[0.85rem] mt-6 font-medium">
        Você também pode restaurar um backup JSON acima.
      </p>
    </BaseEmptyState>
  );
}