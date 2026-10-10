import { Modal } from "../../ui/Modal";
import type { DuplicateModalProps } from "../../../types/scanner";

export function DuplicateModal({ duplicateReceipt, onCancel, onForceSave, matchLevel = "exact" }: DuplicateModalProps) {
  const isProbable = matchLevel === "probable";

  return (
    <Modal
      open
      onClose={onCancel}
      title={isProbable ? "Possível Nota Duplicada" : "Nota Já Existente"}
      noClose
      closeOnEscape={false}
    >
        <p className="text-slate-400 text-[0.95rem] mb-6 leading-relaxed">
          {isProbable ? (
            <>
              Encontramos uma nota que pode representar a mesma compra, registrada por outro método
              em <strong className="text-amber-400">{duplicateReceipt.date}</strong>. Atualizar irá
              substituir essa nota.
            </>
          ) : (
            <>
              Esta nota fiscal já está no seu histórico desde{" "}
              <strong className="text-amber-400">{duplicateReceipt.date}</strong>.
            </>
          )}
        </p>

        <div className="grid grid-cols-2 gap-3">
          <button
            className="btn bg-white/5 border border-[var(--card-border)]"
            onClick={onCancel}
          >
            Cancelar
          </button>
          <button className="btn btn-success" onClick={onForceSave}>
            {isProbable ? "Substituir Nota" : "Atualizar Nota"}
          </button>
        </div>

        <p className="text-slate-500 text-sm mt-4 text-center">
          {isProbable
            ? "Se não for a mesma compra, escolha Cancelar para manter ambas."
            : "Isso substituirá a nota anterior"}
        </p>
    </Modal>
  );
}
