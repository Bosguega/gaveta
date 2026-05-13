import type { ReactNode } from "react";

interface EmptyStateProps {
    icon?: ReactNode;
    title: string;
    description: string;
    action?: {
        label: string;
        onClick: () => void;
    };
}

/**
 * EmptyState — Estado vazio genérico
 *
 * Exibe ícone, título, descrição e ação opcional
 * Substitui estados vazios manuais em History, ShoppingList, Search
 */
export function EmptyState({
    icon,
    title,
    description,
    action,
}: EmptyStateProps) {
    return (
        <div className="glass-card text-center py-12 px-4">
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
        </div>
    );
}