import { useState } from "react";
import { ListChecks, Users } from "lucide-react";
import { useReceiptsSessionStore } from "../../stores/useReceiptsSessionStore";
import { LocalShoppingListTab } from "./LocalShoppingListTab";
import { CollaborativeShoppingListTab } from "./CollaborativeShoppingListTab";
import type { ShoppingMode } from "./ShoppingListTab.types";

/**
 * Componente principal da Lista de Compras
 *
 * Orquestra os modos local e colaborativo,
 * permitindo que o usuário alterne entre eles.
 *
 * @example
 * ```tsx
 * <ShoppingListTab />
 * ```
 */
export default function ShoppingListTab() {
  const sessionUserId = useReceiptsSessionStore((state) => state.sessionUserId);
  const isAuthenticated = Boolean(sessionUserId);

  const [mode, setMode] = useState<ShoppingMode>("local");

  const handleSwitchToCollab = () => {
    if (!isAuthenticated) {
      setMode("local");
      return;
    }
    setMode("collab");
  };

  const handleSwitchToLocal = () => {
    setMode("local");
  };

  return (
    <div>
      {/* Header com seletor de modo */}
      <div className="shopping-tab-header">
        <div>
          <h2 className="section-title mb-1">
            {mode === "local" ? (
              <>
                <ListChecks size={20} color="var(--primary)" />
                Lista de Compras
              </>
            ) : (
              <>
                <Users size={20} color="var(--primary)" />
                Lista Colaborativa
              </>
            )}
          </h2>
        </div>

        <div className="shopping-mode-actions">
          <button
            className={`btn ${mode === "local" ? "bg-[var(--primary-gradient)]" : "bg-white/10 shadow-none hover:bg-white/20"}`}
            onClick={handleSwitchToLocal}
          >
            Lista Local
          </button>
          <button
            className={`btn ${mode === "collab" ? "bg-gradient-to-br from-sky-500 to-blue-600" : "bg-white/10 shadow-none hover:bg-white/20"} ${!isAuthenticated ? "opacity-70" : ""}`}
            onClick={handleSwitchToCollab}
            disabled={!isAuthenticated}
            title={!isAuthenticated ? "Faca login para usar listas colaborativas" : undefined}
          >
            <Users size={15} /> Colaborativa
          </button>
        </div>
      </div>

      {/* Renderiza o componente apropriado baseado no modo */}
      {mode === "local" ? (
        <LocalShoppingListTab onSwitchToCollab={handleSwitchToCollab} />
      ) : (
        <CollaborativeShoppingListTab onSwitchToLocal={handleSwitchToLocal} />
      )}
    </div>
  );
}
