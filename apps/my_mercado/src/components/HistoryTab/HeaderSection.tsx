import { History, Download, Upload, Save } from "lucide-react";
import type { HeaderSectionProps } from "./HistoryTab.types";

export function HeaderSection({
  totalCount,
  filteredCount,
  isLoading,
  onRefresh,
  onBackup,
  onRestore,
  onExportCSV,
}: HeaderSectionProps) {
  return (
    <div className="flex justify-between items-start mb-5 gap-4">
      <div className="flex-1">
        <h2 className="section-title mb-1">
          <History size={20} color="var(--primary)" />
          Histórico
        </h2>
        <div className="text-xs text-slate-500 ml-8">
          {filteredCount} de {totalCount} notas
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={onRefresh}
          className="btn p-2 bg-slate-400/10 border-none text-slate-400 rounded-lg"
          title="Sincronizar"
          disabled={isLoading}
        >
          <History size={20} className={isLoading ? "spin" : ""} />
        </button>

        <input
          type="file"
          id="restore-input"
          accept=".json"
          onChange={onRestore}
          className="hidden"
        />
        <button
          onClick={() => {
            const restoreInput = document.getElementById("restore-input") as HTMLInputElement | null;
            restoreInput?.click();
          }}
          className="btn p-2 bg-emerald-500/10 border-none text-emerald-500 rounded-lg"
          title="Restaurar Backup"
        >
          <Upload size={20} />
        </button>

        <button
          onClick={onBackup}
          className="btn p-2 bg-blue-500/10 border-none text-[var(--primary)] rounded-lg"
          title="Backup"
        >
          <Save size={20} />
        </button>
        <button
          onClick={onExportCSV}
          className="btn p-2 bg-amber-500/10 border-none text-amber-500 rounded-lg"
          title="CSV"
        >
          <Download size={20} />
        </button>
      </div>
    </div>
  );
}
