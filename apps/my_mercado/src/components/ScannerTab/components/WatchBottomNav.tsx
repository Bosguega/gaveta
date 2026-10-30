import type { ElementType } from "react";

export interface WatchNavItem<T extends string> {
  id: T;
  label: string;
  icon: ElementType;
  ariaLabel?: string;
}

export interface WatchBottomNavProps<T extends string> {
  items: WatchNavItem<T>[];
  activeId: T;
  onChange: (id: T) => void;
  accentColor?: "blue" | "emerald";
  disabled?: boolean;
}

/**
 * WatchBottomNav — Menu de navegação inferior inspirado em aplicativos de relógio
 * modernos (Apple Watch / Wear OS / Google Clock).
 *
 * Características:
 * - Layout horizontal distribuído equilibradamente lado a lado
 * - Ícone nítido + rótulo curto e objetivo
 * - Destaque claro em cápsula/pill na opção ativa com glow sutil
 * - Área de toque generosa e confortável (mínimo 48px)
 * - Acessibilidade completa (role="tablist", role="tab", aria-selected)
 * - Posicionamento sticky na base da área de conteúdo com safe-area
 */
export function WatchBottomNav<T extends string>({
  items,
  activeId,
  onChange,
  accentColor = "blue",
  disabled = false,
}: WatchBottomNavProps<T>) {
  const accentClass = accentColor === "emerald" ? "accent-emerald" : "accent-blue";

  return (
    <div
      className="watch-bottom-nav-container"
      role="tablist"
      aria-label="Opções de entrada de nota"
    >
      <nav className="watch-bottom-nav">
        {items.map((item) => {
          const isActive = activeId === item.id;
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-label={item.ariaLabel || item.label}
              className={`watch-nav-item ${isActive ? `active ${accentClass}` : ""}`}
              onClick={() => onChange(item.id)}
              disabled={disabled}
            >
              <Icon size={20} aria-hidden="true" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
