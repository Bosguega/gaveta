import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Maximize2, Minus, X } from "lucide-react";

interface ModalProps {
    open: boolean;
    onClose: () => void;
    title?: ReactNode;
    children: ReactNode;
    footer?: ReactNode;
    maxWidth?: string;
    zIndex?: number;
    /** Esconde o botão X no header (fluxos obrigatórios, ex.: DuplicateModal) */
    noClose?: boolean;
    /** Permite fechar via Escape (padrão true) */
    closeOnEscape?: boolean;
    /** Exibe o botão de minimizar (padrão false — diálogos de decisão não minimizam) */
    minimizable?: boolean;
    /** Operação crítica em andamento: bloqueia X e Escape (minimizar continua liberado) */
    busy?: boolean;
    /** Nome acessível do diálogo quando não há title (também usado no chip) */
    ariaLabel?: string;
    /** Rótulo do chip de restauração quando title não é uma string */
    minimizeLabel?: string;
    /** Classe extra no card (ex.: padding próprio do conteúdo) */
    cardClassName?: string;
    /** Estilo extra no card (ex.: borda de destaque) */
    cardStyle?: CSSProperties;
}

const FOCUSABLE_SELECTOR =
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getFocusable(container: HTMLElement): HTMLElement[] {
    // Estrutural (sem geometria): funciona em jsdom e cobre apenas o conteúdo
    // visível — o card fica display:none quando minimizado e, nesse estado,
    // o trap é direcionado exclusivamente ao chip de restauração.
    return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
}

/**
 * Modal — base compartilhada de diálogos do app.
 *
 * - Renderizado via portal em document.body: imune a overflow/transform de ancestrais.
 * - Backdrop nunca fecha; fechamento apenas pelo botão X (via onClose protegido).
 * - Escape respeita closeOnEscape/busy; quando minimizado, Escape restaura.
 * - Minimização preserva o conteúdo montado (estado intacto) e mantém o fundo
 *   bloqueado: o overlay continua cobrindo a tela (transparente) e o foco fica
 *   preso no chip de restauração.
 * - Acessibilidade: role=dialog, aria-modal, nome acessível, foco inicial,
 *   devolução de foco ao fechar e trap de Tab dentro do diálogo.
 */
export function Modal({
    open,
    onClose,
    title,
    children,
    footer,
    maxWidth = "440px",
    zIndex = 4600,
    noClose = false,
    closeOnEscape = true,
    minimizable = false,
    busy = false,
    ariaLabel,
    minimizeLabel,
    cardClassName,
    cardStyle,
}: ModalProps) {
    const [minimized, setMinimized] = useState(false);
    const cardRef = useRef<HTMLDivElement>(null);
    const chipRef = useRef<HTMLButtonElement>(null);
    const titleId = useId();

    // Foco inicial ao abrir + devolução do foco ao fechar/desmontar.
    useEffect(() => {
        if (!open) {
            // Próxima abertura sempre começa exposto.
            setMinimized(false);
            return;
        }

        const previouslyFocused =
            document.activeElement instanceof HTMLElement ? document.activeElement : null;

        const timer = window.setTimeout(() => {
            const container = cardRef.current;
            if (!container) return;
            // Respeita autoFocus de inputs internos.
            if (container.contains(document.activeElement)) return;
            container.focus();
        }, 0);

        return () => {
            window.clearTimeout(timer);
            if (previouslyFocused && document.contains(previouslyFocused)) {
                previouslyFocused.focus();
            }
        };
    }, [open]);

    if (!open) return null;

    const restore = () => {
        setMinimized(false);
        window.setTimeout(() => cardRef.current?.focus(), 0);
    };

    const minimize = () => {
        setMinimized(true);
        window.setTimeout(() => chipRef.current?.focus(), 0);
    };

    const handleRequestClose = () => {
        if (!busy) onClose();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === "Escape") {
            if (!closeOnEscape || busy) return;
            event.stopPropagation();
            if (minimized) {
                restore();
            } else {
                onClose();
            }
            return;
        }

        if (event.key === "Tab") {
            if (minimized) {
                // Foco preso no chip de restauração enquanto minimizado.
                event.preventDefault();
                chipRef.current?.focus();
                return;
            }

            const container = cardRef.current;
            if (!container) return;

            const focusable = getFocusable(container);
            if (focusable.length === 0) {
                event.preventDefault();
                container.focus();
                return;
            }

            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            const active = document.activeElement;
            const inside = active instanceof Node && container.contains(active);

            if (event.shiftKey) {
                if (!inside || active === first) {
                    event.preventDefault();
                    last.focus();
                }
            } else if (!inside || active === last) {
                event.preventDefault();
                first.focus();
            }
        }
    };

    const stringLabel = typeof title === "string" ? title : undefined;
    const chipLabel = minimizeLabel ?? stringLabel ?? ariaLabel ?? "Janela";
    const showHeader = Boolean(title) || minimizable;

    return createPortal(
        <>
            <div
                className="duplicate-modal-overlay"
                data-minimized={minimized ? "true" : "false"}
                style={{ zIndex }}
                onKeyDown={handleKeyDown}
            >
                <div
                    ref={cardRef}
                    className={`glass-card duplicate-modal-card${cardClassName ? ` ${cardClassName}` : ""}`}
                    style={{
                        maxWidth,
                        marginBottom: 0,
                        outline: "none",
                        ...(minimized ? { display: "none" } : {}),
                        ...cardStyle,
                    }}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby={title ? titleId : undefined}
                    aria-label={title ? undefined : (ariaLabel ?? "Diálogo")}
                    tabIndex={-1}
                >
                    {/* Header */}
                    {showHeader && (
                        <div
                            style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                gap: "0.75rem",
                                marginBottom: "1.25rem",
                            }}
                        >
                            {title ? (
                                <h3
                                    id={titleId}
                                    style={{ color: "#fff", fontSize: "1.15rem", margin: 0, minWidth: 0 }}
                                >
                                    {title}
                                </h3>
                            ) : (
                                <span />
                            )}
                            <div style={{ display: "flex", gap: "4px", flexShrink: 0 }}>
                                {minimizable && (
                                    <button
                                        type="button"
                                        className="modal-icon-btn"
                                        onClick={minimize}
                                        aria-label="Minimizar"
                                        title="Minimizar"
                                    >
                                        <Minus size={20} />
                                    </button>
                                )}
                                {!noClose && (
                                    <button
                                        type="button"
                                        className="modal-icon-btn"
                                        onClick={handleRequestClose}
                                        disabled={busy}
                                        aria-label="Fechar"
                                        title="Fechar"
                                    >
                                        <X size={20} />
                                    </button>
                                )}
                            </div>
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

            {minimizable && minimized && (
                <button
                    ref={chipRef}
                    type="button"
                    className="modal-restore-chip"
                    style={{ zIndex: zIndex + 1 }}
                    onClick={restore}
                    onKeyDown={handleKeyDown}
                    aria-label={`Restaurar ${chipLabel}`}
                    title={`Restaurar ${chipLabel}`}
                >
                    <Maximize2 size={16} />
                    <span className="modal-restore-chip-label">{chipLabel}</span>
                </button>
            )}
        </>,
        document.body,
    );
}