import type { ReactNode } from "react";

export interface EmptyStateProps {
    icon?: ReactNode;
    title: string;
    description: string;
    action?: {
        label: string;
        onClick: () => void;
    };
    children?: ReactNode;
    className?: string;
}

/**
 * EmptyState — Estado vazio genérico
 *
 * Exibe ícone, título, descrição, ação opcional e conteúdo customizado (children).
 */
export function EmptyState({
    icon,
    title,
    description,
    action,
    children,
    className = "glass-card text-center py-12 px-4",
}: EmptyStateProps) {
    return (
        <div className={className}>
            {icon && (
                <div className="flex justify-center mb-4 opacity-30">
                    {icon}
                </div>
            )}
            <h3 className="text-slate-200 text-lg font-semibold mb-2">
                {title}
            </h3>
            <p className="text-slate-400 max-w-[300px] mx-auto leading-relaxed text-sm">
                {description}
            </p>
            {action && (
                <button
                    className="btn mt-6"
                    onClick={action.onClick}
                >
                    {action.label}
                </button>
            )}
            {children}
        </div>
    );
}