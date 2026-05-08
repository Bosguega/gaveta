import type { ConfirmDialogProps } from "../types/ui";

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="duplicate-modal-overlay" style={{ zIndex: 4500 }}>
      <div className="glass-card duplicate-modal-card" style={{ maxWidth: "460px" }}>
        <h3 style={{ color: "#fff", marginBottom: "0.75rem" }}>{title}</h3>
        <p style={{ color: "#94a3b8", lineHeight: "1.5", marginBottom: "1.25rem" }}>{message}</p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
          <button
            className="btn"
            onClick={onCancel}
            disabled={busy}
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--card-border)" }}
          >
            {cancelText}
          </button>
          <button
            className={`btn ${danger ? "" : "btn-success"}`}
            onClick={onConfirm}
            disabled={busy}
            style={
              danger
                ? {
                    background: "rgba(239, 68, 68, 0.15)",
                    border: "1px solid rgba(239, 68, 68, 0.35)",
                    color: "#fca5a5",
                  }
                : undefined
            }
          >
            {busy ? "Processando..." : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
