import type { ReactNode, CSSProperties } from "react";

type CardVariant = "default" | "compact" | "bordered";

interface CardProps {
    variant?: CardVariant;
    onClick?: () => void;
    children: ReactNode;
    className?: string;
    style?: CSSProperties;
}

/**
 * Card — Componente base de cartão glassmorphism
 *
 * Substitui usos de `<div className="glass-card ...">`
 * Variantes:
 *   - default: padding normal (glass-card padrão)
 *   - compact: padding reduzido
 *   - bordered: borda destacada (primary)
 */
export function Card({
    variant = "default",
    onClick,
    children,
    className = "",
    style,
}: CardProps) {
    const variantStyle: CSSProperties =
        variant === "compact"
            ? { padding: "var(--space-3)" }
            : variant === "bordered"
                ? { border: "1px solid var(--primary)" }
                : {};

    return (
        <div
            className={`glass-card ${onClick ? "cursor-pointer" : ""} ${className}`}
            style={{ ...variantStyle, ...style }}
            onClick={onClick}
            role={onClick ? "button" : undefined}
            tabIndex={onClick ? 0 : undefined}
            onKeyDown={
                onClick
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onClick();
                        }
                    }
                    : undefined
            }
        >
            {children}
        </div>
    );
}