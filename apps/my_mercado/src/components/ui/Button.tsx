import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "success" | "danger" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    loading?: boolean;
    icon?: ReactNode;
    children?: ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
    primary: "btn",
    success: "btn btn-success",
    danger: "btn",
    ghost: "btn",
};

const variantStyles: Record<ButtonVariant, React.CSSProperties | undefined> = {
    primary: undefined,
    success: undefined,
    danger: {
        background: "rgba(239, 68, 68, 0.15)",
        border: "1px solid rgba(239, 68, 68, 0.35)",
        color: "#fca5a5",
        boxShadow: "none",
    },
    ghost: {
        background: "rgba(255,255,255,0.05)",
        border: "1px solid var(--card-border)",
        boxShadow: "none",
    },
};

/**
 * Button — Componente de botão unificado
 *
 * Substitui usos manuais de `<button className="btn ...">`
 * Variantes: primary (padrão), success, danger, ghost
 */
export function Button({
    variant = "primary",
    loading = false,
    icon,
    children,
    disabled,
    style,
    ...props
}: ButtonProps) {
    return (
        <button
            className={variantClasses[variant]}
            disabled={disabled || loading}
            style={{ ...variantStyles[variant], ...style }}
            {...props}
        >
            {loading ? (
                <span className="spin" style={{ width: 18, height: 18, border: "2px solid currentColor", borderTopColor: "transparent", borderRadius: "50%", display: "inline-block" }} />
            ) : icon ? (
                icon
            ) : null}
            {children && <span>{children}</span>}
        </button>
    );
}