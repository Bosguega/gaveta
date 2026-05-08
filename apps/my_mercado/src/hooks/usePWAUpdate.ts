/**
 * PWA Update Notification Hook
 *
 * Detecta quando há nova versão do app e notifica o usuário.
 * @see https://vite-pwa-org.netlify.app/guide/register-mode.html#prompt
 */

import { useEffect, useState } from "react";

export interface PWAUpdateState {
  /** Há atualização disponível? */
  updateAvailable: boolean;
  /** Service Worker está sendo instalado? */
  installing: boolean;
  /** Service Worker está instalado e aguardando ativação? */
  installed: boolean;
  /** Nova versão está pronta? */
  readyToInstall: boolean;
  /** Função para atualizar */
  updateApp: () => void;
}

/**
 * Hook para detectar e instalar atualizações do PWA
 */
export function usePWAUpdate(): PWAUpdateState {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [readyToInstall, setReadyToInstall] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    // Apenas em produção
    if (!import.meta.env.PROD) {
      return;
    }

    // Listener para updates do Service Worker
    const listener = async (event: MessageEvent) => {
      if (event.data && event.data.type === "UPDATE_AVAILABLE") {
        setUpdateAvailable(true);
        setReadyToInstall(true);
      }
    };

    navigator.serviceWorker.addEventListener("message", listener);

    // Verificar se há worker aguardando
    navigator.serviceWorker.getRegistration().then((registration) => {
      if (registration?.waiting) {
        setWaitingWorker(registration.waiting);
        setInstalled(true);
        setReadyToInstall(true);
      }

      // Listener para mudanças no worker
      if (registration?.installing) {
        setInstalling(true);

        registration.installing.addEventListener("statechange", (e) => {
          const target = e.target as ServiceWorker;
          if (target.state === "installed") {
            setInstalling(false);
            setInstalled(true);
            setWaitingWorker(target);
            setReadyToInstall(true);
          }
        });
      }
    });

    return () => {
      navigator.serviceWorker.removeEventListener("message", listener);
    };
  }, []);

  /**
   * Instala a atualização e recarrega a página
   */
  const updateApp = () => {
    if (waitingWorker) {
      waitingWorker.addEventListener("statechange", (e) => {
        const target = e.target as ServiceWorker;
        if (target.state === "activated") {
          window.location.reload();
        }
      });

      waitingWorker.postMessage({ type: "SKIP_WAITING" });
    } else {
      // Fallback: apenas recarrega
      window.location.reload();
    }
  };

  return {
    updateAvailable,
    installing,
    installed,
    readyToInstall,
    updateApp,
  };
}

/**
 * Registra listener global para atualizações
 * Deve ser chamado no main.tsx
 */
export function registerPWAUpdateListener() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("message", (event) => {
      if (event.data && event.data.type === "SKIP_WAITING") {
        // Skip waiting message
      }
    });
  }
}

/**
 * Envia mensagem de update disponível
 * Deve ser chamado no service worker
 */
export function notifyUpdateAvailable() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.ready.then((registration) => {
      if (registration.waiting) {
        registration.waiting.postMessage({ type: "SKIP_WAITING" });
      }
    });
  }
}
