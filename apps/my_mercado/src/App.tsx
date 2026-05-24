import { useState, useEffect, lazy, Suspense } from "react";
import {
  Scan,
  History as HistoryIcon,
  ListChecks,
  Search,
  Settings as SettingsIcon,
} from "lucide-react";
import Login from "./components/Login";
import { Toaster } from "react-hot-toast";
import { notify } from "./utils/notifications";
import { logger } from "./utils/logger";
import { isSupabaseConfigured } from "./services/supabaseClient";
import { useApiKey } from "./hooks/useApiKey";
import { useSupabaseSession } from "./hooks/useSupabaseSession";
import ApiKeyModal from "./components/ApiKeyModal";
import { PerformancePanel } from "./components/PerformancePanel";
import { PWAUpdateNotification } from "./components/PWAUpdateNotification";
import { TabSkeleton } from "./components/Skeleton";
import { logPWADebugInfo } from "./utils/pwaDebug";
import { debugDatabaseConnection } from "./utils/dbDebug";
import type { AppTab } from "./types/ui";
import { useReceiptsSessionStore } from "./stores/useReceiptsSessionStore";
import { useScannerStore } from "./stores/useScannerStore";
import { useUiStore } from "./stores/useUiStore";
import { useShoppingListStore } from "./stores/useShoppingListStore";
import { useAllReceiptsQuery } from "./hooks/queries/useReceiptsQuery";
import { isShoppingListCloudSyncEnabled } from "./utils/shoppingListCloudSync";
import "./index.css";

const LAZY_RELOAD_KEY = "@MyMercado:lazy-reload-once";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function lazyWithRetry<T extends { default: React.ComponentType<any> }>(
  importer: () => Promise<T>,
) {
  return lazy(async () => {
    try {
      const module = await importer();
      try {
        sessionStorage.removeItem(LAZY_RELOAD_KEY);
      } catch {
        // noop
      }
      return module;
    } catch (error) {
      try {
        const alreadyReloaded = sessionStorage.getItem(LAZY_RELOAD_KEY) === "1";
        if (!alreadyReloaded) {
          sessionStorage.setItem(LAZY_RELOAD_KEY, "1");
          window.location.reload();
        }
      } catch {
        // noop
      }
      throw error;
    }
  });
}

// Lazy loading das abas para melhor performance
const ScannerTab = lazyWithRetry(() => import("./components/ScannerTab"));
const ShoppingListTab = lazyWithRetry(() => import("./components/ShoppingListTab"));
const HistoryTab = lazyWithRetry(() => import("./components/HistoryTab"));
const SearchTab = lazyWithRetry(() => import("./components/SearchTab"));
const SettingsTab = lazyWithRetry(() => import("./components/SettingsTab"));

function App() {
  const { sessionUser, setSessionUser, authLoading } = useSupabaseSession();

  const setSessionUserId = useReceiptsSessionStore((state) => state.setSessionUserId);
  const setError = useReceiptsSessionStore((state) => state.setError);
  const resetScannerState = useScannerStore((state) => state.resetScannerState);

  const tab = useUiStore((state) => state.tab);
  const setTab = useUiStore((state) => state.setTab);

  // React Query para carregar receipts (sempre busca, mas tenta Supabase se logado)
  const { error: receiptsError, refetch } = useAllReceiptsQuery(!!sessionUser);

  useEffect(() => {
    setSessionUserId(sessionUser?.id ?? null);
    if (!sessionUser) {
      resetScannerState();
    }
  }, [resetScannerState, sessionUser, setSessionUserId]);

  // Sincronizar dados locais quando usuário logar
  useEffect(() => {
    if (sessionUser) {
      // Aguardar um pouco para garantir que o auth está estabilizado
      const timer = setTimeout(async () => {
        try {
          const { syncLocalStorageWithSupabase } = await import('./services/syncService');
          const result = await syncLocalStorageWithSupabase();
          const shouldSyncShoppingLists = isShoppingListCloudSyncEnabled();

          if (result.synced > 0) {
            notify.success(`${result.synced} nota(s) sincronizada(s) com a nuvem!`);
          }

          if (shouldSyncShoppingLists && sessionUser?.id) {
            const { syncShoppingListsWithCloud } = await import(
              "./services/shoppingListCloudSyncService"
            );
            const shoppingSync = await syncShoppingListsWithCloud(sessionUser.id);

            if (shoppingSync.status === "pulled") {
              notify.success("Listas de compras atualizadas com dados da nuvem.");
            } else if (shoppingSync.status === "pushed") {
              notify.success("Listas de compras enviadas para a nuvem.");
            } else if (shoppingSync.status === "skipped" && import.meta.env.DEV) {
              logger.warn("App", "Sincronizacao de listas ignorada", shoppingSync.reason);
            }
          }

          // Re-fetch para atualizar dados do Supabase
          await refetch();
        } catch (error) {
          console.warn('Erro ao sincronizar dados locais:', error);
        }
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [sessionUser, refetch]);

  useEffect(() => {
    if (!sessionUser?.id) return;

    let disposed = false;
    let syncTimer: ReturnType<typeof setTimeout> | null = null;
    let syncInFlight = false;
    let syncPending = false;

    const runSync = async () => {
      if (disposed || !sessionUser?.id) return;
      if (!isShoppingListCloudSyncEnabled()) return;

      if (syncInFlight) {
        syncPending = true;
        return;
      }

      syncInFlight = true;
      try {
        const { syncShoppingListsWithCloud } = await import(
          "./services/shoppingListCloudSyncService"
        );
        await syncShoppingListsWithCloud(sessionUser.id);
      } catch (error) {
        if (import.meta.env.DEV) {
          console.warn("Falha no autosync de listas:", error);
        }
      } finally {
        syncInFlight = false;
        if (syncPending && !disposed) {
          syncPending = false;
          if (syncTimer) clearTimeout(syncTimer);
          syncTimer = setTimeout(() => {
            void runSync();
          }, 800);
        }
      }
    };

    let previousUpdatedAt: string | null =
      useShoppingListStore.getState().dataByUser[sessionUser.id]?.updatedAt ?? null;

    const unsubscribe = useShoppingListStore.subscribe((state) => {
      const currentUpdatedAt = state.dataByUser[sessionUser.id]?.updatedAt ?? null;
      if (currentUpdatedAt && currentUpdatedAt !== previousUpdatedAt) {
        previousUpdatedAt = currentUpdatedAt;
        if (isShoppingListCloudSyncEnabled()) {
          if (syncTimer) clearTimeout(syncTimer);
          syncTimer = setTimeout(() => {
            void runSync();
          }, 2500);
        }
      }
    });

    return () => {
      disposed = true;
      if (syncTimer) clearTimeout(syncTimer);
      unsubscribe();
    };
  }, [sessionUser]);

  useEffect(() => {
    if (receiptsError) {
      setError(receiptsError);

      // Verificar se é erro de autenticação (esperado em alguns casos)
      const isAuthError =
        receiptsError.message?.includes('autenticado') ||
        receiptsError.message?.includes('Unauthorized') ||
        receiptsError.message?.includes('401');

      // Só mostrar toast se NÃO for erro de autenticação
      if (!isAuthError) {
        notify.error("Erro ao sincronizar dados com o servidor. Exibindo dados locais.");

        // Debug automático quando há erro
        if (import.meta.env.DEV) {
          debugDatabaseConnection();
        }
      } else {
        // Erro de autenticação é normal - apenas log em dev
        if (import.meta.env.DEV) {
          // Usuário não autenticado, usando dados locais se disponíveis
        }
      }
    } else {
      setError(null);
    }
  }, [receiptsError, setError]);

  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const aiConfig = useApiKey();
  const { apiKey, hasAiConfig, persistApiKey, setPersistApiKey } = aiConfig;

  useEffect(() => {
    if (!hasAiConfig) {
      setShowApiKeyModal(true);
    }

    // Debug PWA em desenvolvimento
    if (import.meta.env.DEV) {
      logPWADebugInfo();
    }
  }, [hasAiConfig]);

  const handleSaveAiConfig = async () => {
    setShowApiKeyModal(false);
  };

  const handleChangeTab = (nextTab: AppTab) => setTab(nextTab);



  if (!isSupabaseConfigured) {
    return (
      <div className="app-container" style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", padding: "1.5rem" }}>
        <div className="glass-card" style={{ maxWidth: "720px", width: "100%" }}>
          <h2 style={{ color: "#fff", marginBottom: "0.75rem" }}>Configuração necessária</h2>
          <p style={{ color: "#94a3b8", lineHeight: "1.6", marginBottom: "1rem" }}>
            Este deploy não tem o Supabase configurado. Para publicar no GitHub Pages, defina as variáveis
            <strong style={{ color: "#e2e8f0" }}> VITE_SUPABASE_URL</strong> e
            <strong style={{ color: "#e2e8f0" }}> VITE_SUPABASE_ANON_KEY</strong> como <strong style={{ color: "#e2e8f0" }}>secrets</strong> do repositório.
          </p>
          <div style={{ color: "#94a3b8", lineHeight: "1.6" }}>
            <p style={{ marginBottom: "0.5rem" }}><strong style={{ color: "#e2e8f0" }}>Passo a passo:</strong></p>
            <ol style={{ paddingLeft: "1.25rem", margin: 0 }}>
              <li>GitHub → Settings → Secrets and variables → Actions → New repository secret</li>
              <li>Crie <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code></li>
              <li>Vá em Actions e aguarde o workflow &quot;Deploy to GitHub Pages&quot; rodar novamente</li>
              <li>Depois, limpe o cache do site (Application → Clear storage) se ainda ficar em branco</li>
            </ol>
          </div>
        </div>
      </div>
    );
  }


  if (authLoading) {
    return (
      <div className="app-container" style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh" }}>
        <h2 style={{ color: "#fff" }}>Carregando...</h2>
      </div>
    );
  }

  if (!sessionUser) {
    return <Login setSessionUser={setSessionUser} />;
  }

  return (
    <div className="app-container">
      <header className="header">
        <div style={{ flex: 1 }}>
          <h1>My Mercado</h1>
          <p>Economize comparando preços.</p>
        </div>
      </header>

      <main style={{ minHeight: "60vh" }}>
        <Suspense fallback={<TabSkeleton />}>
          {tab === "scan" && <ScannerTab />}
          {tab === "shopping" && <ShoppingListTab />}
          {tab === "history" && <HistoryTab />}
          {tab === "search" && <SearchTab />}
          {tab === "settings" && <SettingsTab onOpenAiConfig={() => setShowApiKeyModal(true)} />}
        </Suspense>
      </main>

      <Toaster
        position="top-center"
        toastOptions={{
          duration: 4000,
          style: {
            background: "rgba(15, 23, 42, 0.95)",
            color: "#fff",
            borderRadius: "12px",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            backdropFilter: "blur(8px)",
          },
          success: {
            iconTheme: {
              primary: "#10b981",
              secondary: "#fff",
            },
          },
          error: {
            iconTheme: {
              primary: "#ef4444",
              secondary: "#fff",
            },
          },
        }}
      />

      {/* PWA Update Notification */}
      <PWAUpdateNotification />

      <nav className="bottom-nav" role="navigation" aria-label="Navegação principal">
        <button
          className={`nav-item ${tab === "scan" ? "active" : ""}`}
          onClick={() => handleChangeTab("scan")}
          aria-label="Escanear nota fiscal"
          aria-current={tab === "scan" ? "page" : undefined}
        >
          <Scan size={22} aria-hidden />
          <span style={{ marginTop: "2px" }}>Escanear</span>
        </button>
        <button
          className={`nav-item ${tab === "shopping" ? "active" : ""}`}
          onClick={() => handleChangeTab("shopping")}
          aria-label="Lista de compras"
          aria-current={tab === "shopping" ? "page" : undefined}
        >
          <ListChecks size={22} aria-hidden />
          <span style={{ marginTop: "2px" }}>Lista</span>
        </button>
        <button
          className={`nav-item ${tab === "history" ? "active" : ""}`}
          onClick={() => handleChangeTab("history")}
          aria-label="Histórico de compras"
          aria-current={tab === "history" ? "page" : undefined}
        >
          <HistoryIcon size={22} aria-hidden />
          <span style={{ marginTop: "2px" }}>Histórico</span>
        </button>
        <button
          className={`nav-item ${tab === "search" ? "active" : ""}`}
          onClick={() => handleChangeTab("search")}
          aria-label="Buscar preços"
          aria-current={tab === "search" ? "page" : undefined}
        >
          <Search size={22} aria-hidden />
          <span style={{ marginTop: "2px" }}>Preços</span>
        </button>
        <button
          className={`nav-item ${tab === "settings" ? "active" : ""}`}
          onClick={() => handleChangeTab("settings")}
          aria-label="Configurações"
          aria-current={tab === "settings" ? "page" : undefined}
        >
          <SettingsIcon size={22} aria-hidden />
          <span style={{ marginTop: "2px" }}>Ajustes</span>
        </button>
      </nav>

      <ApiKeyModal
        isOpen={showApiKeyModal}
        onClose={() => setShowApiKeyModal(false)}
        aiConfig={aiConfig}
        currentKey={apiKey ?? undefined}
        onSave={handleSaveAiConfig}
        persistKey={persistApiKey}
        onPersistChange={setPersistApiKey}
      />

      {/* Performance Panel - apenas em desenvolvimento */}
      <PerformancePanel />
    </div>
  );
}

export default App;
