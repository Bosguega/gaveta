import type { ReactNode } from "react";
import { X } from "lucide-react";

interface ModalProps {
    open: boolean;
    onClose: () => void;
    title?: string;
    children: ReactNode;
    footer?: ReactNode;
    maxWidth?: string;
    zIndex?: number;
    /** Quando true, esconde o botão X no header (útil para fluxos obrigatórios) */
    noClose?: boolean;
}

/**
 * Modal — Componente base de diálogo modal
 *
 * Substitui os overlays manuais espalhados pelo app (ConfirmDialog, InputDialog, etc.)
 * Fornece estrutura consistente: overlay + card + header opcional + body + footer opcional
 */
export function Modal({
    open,
    onClose,
    title,
    children,
    footer,
    maxWidth = "440px",
    zIndex = 4500,
    noClose = false,
}: ModalProps) {
    if (!open) return null;

    return (
        <div
            className="duplicate-modal-overlay"
            style={{ zIndex }}
            onClick={(e) => {
                if (e.target === e.currentTarget && !noClose) onClose();
            }}
        >
            <div
                className="glass-card duplicate-modal-card"
                style={{ maxWidth, marginBottom: 0 }}
            >
                {/* Header */}
                {title && (
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: "1.25rem",
                        }}
                    >
                        <h3 style={{ color: "#fff", fontSize: "1.15rem", margin: 0 }}>
                            {title}
                        </h3>
                        {!noClose && (
                            <button
                                onClick={onClose}
                                style={{
                                    background: "transparent",
                                    border: "none",
                                    color: "#94a3b8",
                                    cursor: "pointer",
                                    padding: "4px",
                                    display: "flex",
                                }}
                                aria-label="Fechar"
                            >
                                <X size={20} />
                            </button>
                        )}
                    </div>
                )}

                {/* Body */}
                <div>{children}</div>

                {/* Footer */}
                {footer && (
                    <div style={{ marginTop: "1.25rem" }}>{footer}</div>
                )}
            </div>
        </div>
    );
}