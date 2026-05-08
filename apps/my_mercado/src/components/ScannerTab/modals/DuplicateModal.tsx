import type { DuplicateModalProps } from "../../../types/scanner";

export function DuplicateModal({ duplicateReceipt, onCancel, onForceSave }: DuplicateModalProps) {
  return (
    <div className="duplicate-modal-overlay z-[3000]">
      <div className="glass-card duplicate-modal-card">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center">
            <span className="text-2xl">⚠️</span>
          </div>
          <h2 className="text-white text-xl">Nota Já Existente</h2>
        </div>

        <p className="text-slate-400 text-[0.95rem] mb-6 leading-relaxed">
          Esta nota fiscal já está no seu histórico desde{" "}
          <strong className="text-amber-400">{duplicateReceipt.date}</strong>.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <button
            className="btn bg-white/5 border border-[var(--card-border)]"
            onClick={onCancel}
          >
            Cancelar
          </button>
          <button className="btn btn-success" onClick={onForceSave}>
            Atualizar Nota
          </button>
        </div>

        <p className="text-slate-500 text-sm mt-4 text-center">
          Isso substituirá a nota anterior
        </p>
      </div>
    </div>
  );
}
