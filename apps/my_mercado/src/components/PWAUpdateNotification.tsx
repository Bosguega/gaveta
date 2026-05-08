/**
 * PWA Update Notification Component
 *
 * Mostra toast quando há nova versão disponível.
 */

import { useEffect } from "react";
import { toast } from "react-hot-toast";
import { usePWAUpdate } from "../hooks/usePWAUpdate";

export function PWAUpdateNotification() {
  const { updateAvailable, readyToInstall, updateApp } = usePWAUpdate();

  useEffect(() => {
    if (updateAvailable && readyToInstall) {
      toast(
        (t) => (
          <div className="flex items-center gap-3">
            <div>
              <strong>Nova versão disponível!</strong>
              <p className="text-sm opacity-90 mt-1">
                Recarregue para aplicar as atualizações.
              </p>
            </div>
            <button
              onClick={() => {
                updateApp();
                toast.dismiss(t.id);
              }}
              className="bg-[var(--primary)] text-white border-none px-4 py-2 rounded-md cursor-pointer font-semibold text-sm"
            >
              Atualizar
            </button>
            <button
              onClick={() => toast.dismiss(t.id)}
              className="bg-transparent text-current border border-current px-3 py-2 rounded-md cursor-pointer text-sm"
            >
              Depois
            </button>
          </div>
        ),
        {
          duration: Infinity, // Não expira
          position: "top-center",
          style: {
            background: "rgba(15, 23, 42, 0.95)",
            color: "#fff",
            borderRadius: "12px",
            border: "1px solid rgba(59, 130, 246, 0.5)",
            backdropFilter: "blur(8px)",
            maxWidth: "400px",
          },
          icon: "🔄",
        }
      );
    }
  }, [updateAvailable, readyToInstall, updateApp]);

  return null; // Componente não renderiza nada visível
}
