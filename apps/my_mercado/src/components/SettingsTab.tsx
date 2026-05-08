import { useState, lazy, Suspense } from "react";
import {
  Settings,
  Trash2,
  Cpu,
  LogOut,
  Database,
  BookOpen,
  Package,
  ChevronRight,
  Wifi,
  RefreshCw,
} from "lucide-react";
import { notify } from "../utils/notifications";
import { logout } from "../services/authService";
import {
  clearReceiptsAndItemsFromDB,
  clearDictionaryInDB,
  clearCanonicalProductsInDB,
} from "../services";
import { syncShoppingListsWithCloud } from "../services/shoppingListCloudSyncService";
import { useScannerStore } from "../stores/useScannerStore";
import { useReceiptsSessionStore } from "../stores/useReceiptsSessionStore";
import { testSupabaseConnection } from "../utils/supabaseTest";
import {
  isShoppingListCloudSyncEnabled,
  setShoppingListCloudSyncEnabled,
} from "../utils/shoppingListCloudSync";
import ConfirmDialog from "./ConfirmDialog";
import { TabSkeleton as SubTabSkeleton } from "./Skeleton";
import type { ConfirmDialogConfig } from "../types/ui";

const DictionaryTab = lazy(() => import("./DictionaryTab"));
const CanonicalProductsTab = lazy(() =>
  import("./CanonicalProductsTab/index").then((module) => ({ default: module.CanonicalProductsTab })),
);

interface SettingsTabProps {
  onOpenAiConfig: () => void;
}

export default function SettingsTab({ onOpenAiConfig }: SettingsTabProps) {
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncListsEnabled, setSyncListsEnabled] = useState(() => isShoppingListCloudSyncEnabled());
  const [activeSubTab, setActiveSubTab] = useState<"main" | "dictionary" | "products">("main");

  const resetScannerState = useScannerStore((state) => state.resetScannerState);
  const sessionUserId = useReceiptsSessionStore((state) => state.sessionUserId);

  const handleLogout = async () => {
    setConfirmDialog({
      title: "Encerrar sessão?",
      message: "Você precisará fazer login novamente para acessar seus dados.",
      confirmText: "Sair",
      danger: true,
      onConfirm: async () => {
        resetScannerState();
        await logout();
        notify.sessionEnded();
      },
    });
  };

  const handleClearHistory = async () => {
    setConfirmDialog({
      title: "Limpar histórico?",
      message: "Esta ação não pode ser desfeita. Todas as notas fiscais serão apagadas.",
      confirmText: "Limpar",
      danger: true,
      onConfirm: async () => {
        setLoading(true);
        try {
          await clearReceiptsAndItemsFromDB();
          notify.success("Histórico limpo com sucesso!");
        } catch {
          notify.errorByKey("SETTINGS_CLEAR_HISTORY_FAILED");
        } finally {
          setLoading(false);
        }
      },
    });
  };

  const handleClearDictionary = async () => {
    setConfirmDialog({
      title: "Limpar dicionário?",
      message: "Esta ação não pode ser desfeita. Todas as normalizações serão apagadas.",
      confirmText: "Limpar",
      danger: true,
      onConfirm: async () => {
        setLoading(true);
        try {
          await clearDictionaryInDB();
          notify.success("Dicionário limpo com sucesso!");
        } catch {
          notify.errorByKey("SETTINGS_CLEAR_DICTIONARY_FAILED");
        } finally {
          setLoading(false);
        }
      },
    });
  };

  const handleClearCanonicalProducts = async () => {
    setConfirmDialog({
      title: "Limpar produtos canônicos?",
      message: "Esta ação não pode ser desfeita. Todos os produtos canônicos serão apagados.",
      confirmText: "Limpar",
      danger: true,
      onConfirm: async () => {
        setLoading(true);
        try {
          await clearCanonicalProductsInDB();
          notify.success("Produtos canônicos limpos com sucesso!");
        } catch {
          notify.errorByKey("SETTINGS_CLEAR_PRODUCTS_FAILED");
        } finally {
          setLoading(false);
        }
      },
    });
  };

  const handleTestConnection = async () => {
    setLoading(true);
    const status = await testSupabaseConnection();
    setLoading(false);

    if (!status.configured) {
      notify.errorByKey("SUPABASE_NOT_CONFIGURED");
      return;
    }

    if (!status.authenticated) {
      notify.errorByKey("AUTH_SESSION_INVALID");
      return;
    }

    if (status.databaseAccessible) {
      notify.success("Conexão com Supabase estabelecida com sucesso!");
    } else {
      notify.error(status.error ?? "Falha ao validar conexão com o banco de dados.");
    }
  };

  const handleToggleCloudSync = () => {
    const next = !syncListsEnabled;
    setSyncListsEnabled(next);
    setShoppingListCloudSyncEnabled(next);

    notify.success(
      next
        ? "Sincronização de listas com nuvem ativada."
        : "Sincronização de listas com nuvem desativada.",
    );
  };

  const handleSyncListsNow = async () => {
    if (!syncListsEnabled) {
      notify.errorByKey("SETTINGS_SYNC_REQUIRED");
      return;
    }

    if (!sessionUserId) {
      notify.errorByKey("AUTH_SESSION_INVALID");
      return;
    }

    setLoading(true);
    try {
      const result = await syncShoppingListsWithCloud(sessionUserId);
      if (result.status === "pushed") {
        notify.success("Listas enviadas para a nuvem.");
      } else if (result.status === "pulled") {
        notify.success("Listas atualizadas a partir da nuvem.");
      } else if (result.status === "unchanged") {
        notify.warning("Listas já estavam sincronizadas.");
      } else {
        notify.errorByKey("SETTINGS_SYNC_FAILED");
      }
    } catch {
      notify.errorByKey("SETTINGS_SYNC_FAILED");
    } finally {
      setLoading(false);
    }
  };

  const renderSubTab = () => {
    if (activeSubTab === "dictionary") {
      return (
        <Suspense fallback={<SubTabSkeleton />}>
          <div className="relative">
            <button
              onClick={() => setActiveSubTab("main")}
              className="btn btn-secondary flex items-center gap-2 mb-4"
            >
              Voltar para Configuracoes
            </button>
            <DictionaryTab />
          </div>
        </Suspense>
      );
    }

    if (activeSubTab === "products") {
      return (
        <Suspense fallback={<SubTabSkeleton />}>
          <div className="relative">
            <button
              onClick={() => setActiveSubTab("main")}
              className="btn btn-secondary flex items-center gap-2 mb-4"
            >
              Voltar para Configuracoes
            </button>
            <CanonicalProductsTab />
          </div>
        </Suspense>
      );
    }

    return null;
  };

  const renderMainScreen = () => (
    <div className="settings-container flex flex-col gap-4">
      <section className="glass-card p-6">
        <h2 className="text-xl flex items-center gap-2 mb-4">
          <Settings size={20} />
          Conta
        </h2>

        <button
          onClick={handleLogout}
          className="btn btn-danger w-full flex items-center justify-between"
        >
          <span className="flex items-center gap-2">
            <LogOut size={18} />
            Encerrar Sessao
          </span>
          <ChevronRight size={18} />
        </button>
      </section>

      <section className="glass-card p-6">
        <h2 className="text-xl flex items-center gap-2 mb-4">
          <Database size={20} />
          Gerenciar Dados
        </h2>

        <div className="flex flex-col gap-3">
          <button
            onClick={() => setActiveSubTab("dictionary")}
            className="btn btn-secondary flex items-center justify-between"
          >
            <span className="flex items-center gap-2">
              <BookOpen size={18} />
              Dicionario de Produtos
            </span>
            <ChevronRight size={18} />
          </button>

          <button
            onClick={() => setActiveSubTab("products")}
            className="btn btn-secondary flex items-center justify-between"
          >
            <span className="flex items-center gap-2">
              <Package size={18} />
              Produtos Canonicos
            </span>
            <ChevronRight size={18} />
          </button>

          <button
            onClick={handleClearHistory}
            className="btn btn-danger flex items-center justify-between"
            disabled={loading}
          >
            <span className="flex items-center gap-2">
              <Trash2 size={18} />
              Limpar Historico
            </span>
            <ChevronRight size={18} />
          </button>

          <button
            onClick={handleClearDictionary}
            className="btn btn-danger flex items-center justify-between"
            disabled={loading}
          >
            <span className="flex items-center gap-2">
              <Trash2 size={18} />
              Limpar Dicionario
            </span>
            <ChevronRight size={18} />
          </button>

          <button
            onClick={handleClearCanonicalProducts}
            className="btn btn-danger flex items-center justify-between"
            disabled={loading}
          >
            <span className="flex items-center gap-2">
              <Trash2 size={18} />
              Limpar Produtos Canonicos
            </span>
            <ChevronRight size={18} />
          </button>
        </div>
      </section>

      <section className="glass-card p-6">
        <h2 className="text-xl flex items-center gap-2 mb-4">
          <Cpu size={20} />
          Inteligencia Artificial
        </h2>

        <button
          onClick={onOpenAiConfig}
          className="btn btn-primary w-full flex items-center justify-between"
        >
          <span className="flex items-center gap-2">
            <Cpu size={18} />
            Configurar API Key
          </span>
          <ChevronRight size={18} />
        </button>
      </section>

      <section className="glass-card p-6">
        <h2 className="text-xl flex items-center gap-2 mb-4">
          <Wifi size={20} />
          Conexao
        </h2>

        <button
          onClick={handleTestConnection}
          className="btn btn-secondary w-full"
          disabled={loading}
        >
          Testar Conexao com Supabase
        </button>

        <div className="mt-3 pt-3 border-t border-slate-400/20 flex flex-col gap-2.5">
          <label className="flex items-center gap-2 text-slate-300">
            <input type="checkbox" checked={syncListsEnabled} onChange={handleToggleCloudSync} />
            Sincronizar listas de compras com nuvem
          </label>

          <button
            onClick={handleSyncListsNow}
            className="btn btn-secondary w-full flex items-center justify-center gap-2"
            disabled={loading || !syncListsEnabled}
          >
            <RefreshCw size={16} />
            Sincronizar listas agora
          </button>
        </div>
      </section>

      {confirmDialog && (
        <ConfirmDialog
          isOpen={true}
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmText={confirmDialog.confirmText}
          danger={confirmDialog.danger}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
        />
      )}
    </div>
  );

  return <div className="settings-tab">{activeSubTab === "main" ? renderMainScreen() : renderSubTab()}</div>;
}
