import { History } from "lucide-react";

export function EmptyState() {
  return (
    <div className="glass-card text-center py-16 px-4">
      <div className="relative inline-block">
        <History
          size={64}
          color="var(--primary)"
          className="opacity-20"
        />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <History size={32} color="var(--primary)" />
        </div>
      </div>
      <h2 className="mt-6 text-slate-200">
        Histórico vazio
      </h2>
      <p className="text-slate-400 mt-2 max-w-[300px] mx-auto">
        Suas notas fiscais escaneadas aparecerão aqui para você acompanhar
        preços e economizar.
      </p>
      <p className="text-[var(--primary)] text-[0.85rem] mt-6 font-medium">
        Você também pode restaurar um backup JSON acima.
      </p>
    </div>
  );
}
