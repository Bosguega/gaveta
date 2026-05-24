import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle,
  Cpu,
  Key,
  RefreshCw,
  Save,
  Server,
  ShieldCheck,
  X,
} from "lucide-react";
import {
  DEFAULT_AI_BASE_URL,
  detectProvider as detectCoreProvider,
  listModels as listGeminiModels,
  ollamaListModels,
  type AIProvider,
  type AIMode,
} from "@bosguega/ai-core";
import { notify } from "../utils/notifications";
import { getAiBaseUrl, getAiMode, getApiKey, getApiModel } from "../utils/ai/aiConfig";
import { testAiConnection, type AiConnectionStatus } from "../utils/ai";
import { validateApiKey } from "../utils/validation";
import { logger } from "../utils/logger";
import type { ApiKeyModalProps } from "../types/ui";

const ONLINE_DEFAULT_MODELS: Record<"gemini" | "openai", string[]> = {
  gemini: [
    "gemini-1.5-flash",
    "gemini-1.5-flash-lite",
    "gemini-1.5-pro",
    "gemini-1.0-pro",
  ],
  openai: ["gpt-3.5-turbo", "gpt-4o-mini", "gpt-4o"],
};

const DEFAULT_MODEL_BY_PROVIDER: Record<AIProvider, string> = {
  gemini: "gemini-1.5-flash-lite",
  openai: "gpt-4o-mini",
  ollama: "",
};

const CONNECTION_LABELS: Record<AiConnectionStatus, string> = {
  idle: "Testar conexao",
  offline: "Offline",
  checking: "Verificando...",
  connected: "Conexao OK",
  loading_model: "Carregando modelo...",
  generating: "Gerando resposta...",
  error: "Erro na conexao",
};

export default function ApiKeyModal({
  isOpen,
  onClose,
  aiConfig,
  currentKey,
  onSave,
  persistKey = false,
  onPersistChange,
}: ApiKeyModalProps) {
  const [mode, setMode] = useState<AIMode>("online");
  const [key, setKey] = useState("");
  const [baseUrl, setBaseUrl] = useState(DEFAULT_AI_BASE_URL);
  const [selectedModel, setSelectedModel] = useState("");
  const [testing, setTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<AiConnectionStatus>("idle");
  const [fetchedModels, setFetchedModels] = useState<string[]>([]);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [localPersist, setLocalPersist] = useState(persistKey);

  useEffect(() => {
    if (!isOpen) return;

    setMode(aiConfig?.mode ?? getAiMode());
    setKey(aiConfig?.apiKey ?? currentKey ?? getApiKey() ?? "");
    setBaseUrl(aiConfig?.baseUrl ?? getAiBaseUrl());
    setSelectedModel(aiConfig?.model ?? getApiModel() ?? "");
    setFetchedModels([]);
    setConnectionStatus("idle");
    setLocalPersist(persistKey);
  }, [aiConfig, currentKey, isOpen, persistKey]);

  const onlineProvider = useMemo(() => {
    const detected = detectCoreProvider(key);
    return detected === "gemini" || detected === "openai" ? detected : "unknown";
  }, [key]);

  const effectiveProvider: AIProvider | "unknown" = mode === "local" ? "ollama" : onlineProvider;
  const providerLabel = effectiveProvider === "gemini"
    ? "Google AI Studio"
    : effectiveProvider === "openai"
      ? "OpenAI"
      : effectiveProvider === "ollama"
        ? "Ollama"
        : "Desconhecido";

  const providerDefaultModel = effectiveProvider === "unknown"
    ? DEFAULT_MODEL_BY_PROVIDER.gemini
    : DEFAULT_MODEL_BY_PROVIDER[effectiveProvider];

  const models = useMemo(() => {
    const hardcoded = mode === "local"
      ? []
      : effectiveProvider === "gemini" || effectiveProvider === "openai"
        ? ONLINE_DEFAULT_MODELS[effectiveProvider]
        : [];

    const all = Array.from(new Set([...hardcoded, ...fetchedModels]));
    if (selectedModel && !all.includes(selectedModel)) {
      all.push(selectedModel);
    }
    return all;
  }, [effectiveProvider, fetchedModels, mode, selectedModel]);

  useEffect(() => {
    if (mode === "local") {
      if (!selectedModel && fetchedModels.length > 0) {
        setSelectedModel(fetchedModels[0]);
      }
      return;
    }

    if (!selectedModel) {
      setSelectedModel(providerDefaultModel);
      return;
    }

    const isGoogleModel = selectedModel.startsWith("gemini-");
    const isOpenAIModel = selectedModel.startsWith("gpt-");
    const providerChanged =
      (effectiveProvider === "gemini" && isOpenAIModel) ||
      (effectiveProvider === "openai" && isGoogleModel);

    if (providerChanged) {
      setSelectedModel(providerDefaultModel);
    }
  }, [effectiveProvider, fetchedModels, mode, providerDefaultModel, selectedModel]);

  const handleModeChange = (nextMode: AIMode) => {
    setMode(nextMode);
    setFetchedModels([]);
    setConnectionStatus("idle");
    if (nextMode === "local") {
      setSelectedModel("");
      setBaseUrl(baseUrl || DEFAULT_AI_BASE_URL);
    } else {
      setSelectedModel(providerDefaultModel);
    }
  };

  const handleListModels = async () => {
    setFetchingModels(true);
    setConnectionStatus("checking");

    try {
      if (mode === "local") {
        const models = await ollamaListModels(baseUrl || DEFAULT_AI_BASE_URL);
        const names = models.map((model) => model.id);
        setFetchedModels(names);
        setSelectedModel((current) => current || names[0] || "");
        setConnectionStatus("connected");
        notify.success(`${names.length} modelos locais encontrados!`);
        return;
      }

      const trimmedKey = key.trim();
      if (!trimmedKey) {
        notify.errorByKey("API_KEY_REQUIRED");
        setConnectionStatus("error");
        return;
      }

      if (onlineProvider === "gemini") {
        const models = await listGeminiModels(trimmedKey);
        const names = models.map((model) => model.id);
        setFetchedModels(names);
        setConnectionStatus("connected");
        notify.success(`${names.length} modelos encontrados!`);
        return;
      }

      if (onlineProvider === "openai") {
        setFetchedModels([]);
        setConnectionStatus("connected");
        notify.success("Modelos OpenAI padrao carregados.");
        return;
      }

      notify.warning("API key nao reconhecida.");
      setConnectionStatus("error");
    } catch (err) {
      logger.error("ApiKeyModal", "Erro ao listar modelos", err);
      setConnectionStatus(mode === "local" ? "offline" : "error");
      notify.errorByKey("AI_CONNECTION_FAILED");
    } finally {
      setFetchingModels(false);
    }
  };

  const validateOnlineKey = () => {
    const trimmedKey = key.trim();
    if (!trimmedKey) {
      notify.errorByKey("API_KEY_REQUIRED");
      return null;
    }

    const validation = validateApiKey(trimmedKey);
    if (!validation.success) {
      notify.error(validation.error);
      return null;
    }

    const detected = detectCoreProvider(trimmedKey);
    if (detected !== "gemini" && detected !== "openai") {
      notify.error("Provider online nao reconhecido para esta chave.");
      return null;
    }

    return { key: trimmedKey, provider: detected };
  };

  const handleSave = async () => {
    const provider = mode === "local" ? "ollama" : onlineProvider;
    const modelToSave = selectedModel || (provider === "unknown" ? "" : DEFAULT_MODEL_BY_PROVIDER[provider]);

    if (mode === "online") {
      const valid = validateOnlineKey();
      if (!valid) return;

      if (onPersistChange) {
        await onPersistChange(localPersist);
      }
      await aiConfig?.setMode("online");
      await aiConfig?.setProvider(valid.provider);
      await aiConfig?.setModel(modelToSave);
      await aiConfig?.setApiKey(valid.key);
      await onSave(valid.key);
    } else {
      if (!modelToSave) {
        notify.warning("Busque e selecione um modelo local antes de salvar.");
        return;
      }

      await aiConfig?.setMode("local");
      await aiConfig?.setProvider("ollama");
      await aiConfig?.setBaseUrl(baseUrl || DEFAULT_AI_BASE_URL);
      await aiConfig?.setModel(modelToSave);
      await aiConfig?.setApiKey(null);
      await onSave();
    }

    notify.settingsSaved();
    onClose();
  };

  const handleTest = async () => {
    const provider = mode === "local" ? "ollama" : onlineProvider;
    if (provider === "unknown") {
      notify.error("Configure uma API key valida antes de testar.");
      return;
    }

    if (mode === "online" && !validateOnlineKey()) return;
    if (!selectedModel) {
      notify.warning("Selecione um modelo antes de testar.");
      return;
    }

    setTesting(true);
    setConnectionStatus("checking");
    try {
      const result = await testAiConnection({
        mode,
        provider,
        apiKey: mode === "online" ? key.trim() : undefined,
        baseUrl: mode === "local" ? baseUrl || DEFAULT_AI_BASE_URL : undefined,
        model: selectedModel,
        onStatus: setConnectionStatus,
      });

      if (result.success) {
        setConnectionStatus("connected");
        notify.success("Conexao estabelecida com sucesso!");
      } else {
        setConnectionStatus(mode === "local" ? "offline" : "error");
        notify.error(`Erro: ${result.error || "Falha na conexao"}`);
      }
    } catch (err) {
      logger.error("ApiKeyModal", "Erro no teste de conexao", err);
      setConnectionStatus("error");
      const errorMsg = err instanceof Error ? err.message : "Erro desconhecido";
      notify.error(`Erro: ${errorMsg}`);
    } finally {
      setTesting(false);
    }
  };

  if (!isOpen) return null;

  const canFetchModels = mode === "local" || !!key.trim();
  const testButtonSuccess = connectionStatus === "connected";
  const testButtonError = ["offline", "error"].includes(connectionStatus);

  return (
    <div className="duplicate-modal-overlay" style={{ zIndex: 5000 }}>
      <div
        className="glass-card duplicate-modal-card"
        style={{ maxWidth: "480px", border: "1px solid var(--primary)" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {mode === "local" ? (
              <Server className="text-primary" size={24} color="var(--primary)" />
            ) : (
              <Key className="text-primary" size={24} color="var(--primary)" />
            )}
            <h2 style={{ color: "#fff", fontSize: "1.25rem", margin: 0 }}>
              Configurar IA
            </h2>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer" }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "1rem" }}>
          <button
            className="btn"
            onClick={() => handleModeChange("online")}
            style={{
              background: mode === "online" ? "rgba(37, 99, 235, 0.18)" : "rgba(255,255,255,0.05)",
              border: mode === "online" ? "1px solid var(--primary)" : "1px solid var(--card-border)",
            }}
          >
            IA Online
          </button>
          <button
            className="btn"
            onClick={() => handleModeChange("local")}
            style={{
              background: mode === "local" ? "rgba(37, 99, 235, 0.18)" : "rgba(255,255,255,0.05)",
              border: mode === "local" ? "1px solid var(--primary)" : "1px solid var(--card-border)",
            }}
          >
            IA Local
          </button>
        </div>

        <div style={{ marginBottom: "1.5rem", background: "rgba(15, 23, 42, 0.4)", padding: "1rem", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.05)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px" }}>
            <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
              Provider:
            </span>
            <span style={{ fontSize: "0.75rem", color: "var(--primary)", fontWeight: "bold" }}>
              {providerLabel}
            </span>
          </div>

          {mode === "local" && (
            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", fontSize: "0.75rem", color: "#64748b", marginBottom: "0.5rem" }}>
                URL local:
              </label>
              <input
                className="search-input"
                style={{ width: "100%", background: "var(--bg-color)", border: "1px solid var(--card-border)" }}
                value={baseUrl}
                placeholder={DEFAULT_AI_BASE_URL}
                onChange={(event) => {
                  setBaseUrl(event.target.value);
                  setConnectionStatus("idle");
                }}
              />
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <label style={{ fontSize: "0.75rem", color: "#64748b" }}>
                Modelo:
              </label>
              <button
                onClick={handleListModels}
                disabled={fetchingModels || !canFetchModels}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--primary)",
                  fontSize: "0.7rem",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  opacity: !canFetchModels ? 0.5 : 1,
                }}
              >
                {fetchingModels ? <RefreshCw size={12} className="spin" /> : <Cpu size={12} />}
                Buscar modelos
              </button>
            </div>
            <select
              className="search-input"
              style={{ width: "100%", background: "var(--bg-color)", border: "1px solid var(--card-border)" }}
              value={selectedModel}
              onChange={(e) => {
                setSelectedModel(e.target.value);
                setConnectionStatus("idle");
              }}
            >
              {models.length === 0 && (
                <option value="">
                  {mode === "local" ? "Busque modelos locais" : "Informe uma API key valida"}
                </option>
              )}
              {models.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </select>
          </div>
        </div>

        {mode === "online" && (
          <div style={{ marginBottom: "1.25rem" }}>
            <label style={{ display: "block", fontSize: "0.8rem", color: "#64748b", marginBottom: "0.5rem", fontWeight: "bold" }}>
              API KEY
            </label>
            <div style={{ position: "relative", marginBottom: "1rem" }}>
              <input
                type="password"
                className="search-input"
                style={{ paddingLeft: "3rem", background: "rgba(15, 23, 42, 0.4)" }}
                placeholder={onlineProvider === "gemini" ? "AIza..." : "sk-..."}
                value={key}
                onChange={(e) => {
                  setKey(e.target.value);
                  setFetchedModels([]);
                  setConnectionStatus("idle");
                }}
              />
              <ShieldCheck size={18} style={{ position: "absolute", left: "1rem", top: "50%", transform: "translateY(-50%)", color: "#64748b" }} />
            </div>

            <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", padding: "8px 0", userSelect: "none" }}>
              <input
                type="checkbox"
                checked={localPersist}
                onChange={(e) => setLocalPersist(e.target.checked)}
                style={{ width: "18px", height: "18px", accentColor: "var(--primary)" }}
              />
              <span style={{ fontSize: "0.85rem", color: "#e2e8f0" }}>
                Salvar permanentemente neste dispositivo
              </span>
            </label>
            <p style={{ fontSize: "0.7rem", color: "#64748b", marginTop: "4px", paddingLeft: "26px" }}>
              {localPersist
                ? "A chave sera mantida no seu navegador mesmo apos fechar o app."
                : "A chave sera apagada por seguranca sempre que voce fechar o navegador."}
            </p>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <button
            className="btn"
            onClick={handleTest}
            disabled={testing}
            style={{
              background: testButtonSuccess ? "rgba(16, 185, 129, 0.1)" : "rgba(255,255,255,0.05)",
              border: testButtonSuccess ? "1px solid var(--success)" : "1px solid var(--card-border)",
              color: testButtonSuccess ? "var(--success)" : "#fff",
            }}
          >
            {testing ? (
              CONNECTION_LABELS[connectionStatus]
            ) : testButtonSuccess ? (
              <>
                <CheckCircle size={18} /> Conexao OK
              </>
            ) : testButtonError ? (
              <>
                <AlertCircle size={18} /> {CONNECTION_LABELS[connectionStatus]}
              </>
            ) : (
              CONNECTION_LABELS[connectionStatus]
            )}
          </button>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <button className="btn" onClick={onClose} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.05)" }}>
              Cancelar
            </button>
            <button className="btn btn-success" onClick={handleSave}>
              <Save size={18} />
              Salvar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
