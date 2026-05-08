import { useState, useEffect, useMemo } from "react";
import {
  Key,
  ShieldCheck,
  X,
  Save,
  CheckCircle,
  AlertCircle,
  Cpu,
  RefreshCw,
} from "lucide-react";
import { notify } from "../utils/notifications";
import { detectProvider, getApiModel, setApiModel } from "../utils/aiConfig";
import { testAiConnection } from "../utils/aiClient";
import { validateApiKey } from "../utils/validation";
import { logger } from "../utils/logger";
import type { ApiKeyModalProps } from "../types/ui";

export default function ApiKeyModal({
  isOpen,
  onClose,
  currentKey,
  onSave,
  persistKey = false,
  onPersistChange,
}: ApiKeyModalProps) {
  const [key, setKey] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"success" | "error" | null>(null);
  const [fetchedModels, setFetchedModels] = useState<string[]>([]);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [localPersist, setLocalPersist] = useState(persistKey);

  // Sincronizar estados quando o modal abre ou a chave muda
  useEffect(() => {
    if (isOpen) {
      setKey(currentKey || "");
      setSelectedModel(getApiModel() || "");
      setFetchedModels([]);
      setTestResult(null);
      setLocalPersist(persistKey);
    }
  }, [currentKey, isOpen, persistKey]);

  // Detectar provedor com base na chave atual (estado local)
  const provider = useMemo(() => detectProvider(key), [key]);

  const providerDefaultModel = useMemo(() => {
    return provider === "Google AI Studio" ? "gemini-1.5-flash-lite" : "gpt-4o-mini";
  }, [provider]);

  // Gerar lista de modelos combinando hardcoded + buscados da API
  const models = useMemo(() => {
    const isGoogle = provider === "Google AI Studio";
    const hardcoded = isGoogle
      ? [
          "gemini-1.5-flash",
          "gemini-1.5-flash-lite",
          "gemini-1.5-pro",
          "gemini-1.0-pro",
        ]
      : ["gpt-3.5-turbo", "gpt-4o-mini", "gpt-4o"];

    // Unificar listas e remover duplicatas
    const all = Array.from(new Set([...hardcoded, ...fetchedModels]));

    // Garantir que o modelo selecionado apareça na lista (caso seja customizado)
    if (selectedModel && !all.includes(selectedModel)) {
      all.push(selectedModel);
    }
    return all;
  }, [provider, fetchedModels, selectedModel]);

  useEffect(() => {
    if (!selectedModel) {
      setSelectedModel(providerDefaultModel);
      return;
    }

    const isGoogleModel = selectedModel.startsWith("gemini-");
    const isOpenAIModel = selectedModel.startsWith("gpt-");
    const providerChanged =
      (provider === "Google AI Studio" && isOpenAIModel) ||
      (provider === "OpenAI" && isGoogleModel);

    if (providerChanged) {
      setSelectedModel(providerDefaultModel);
    }
  }, [provider, providerDefaultModel, selectedModel]);

  const handleSave = () => {
    const trimmedKey = key.trim();
    if (!trimmedKey) {
      notify.errorByKey("API_KEY_REQUIRED");
      return;
    }

    const validation = validateApiKey(trimmedKey);
    if (!validation.success) {
      notify.error(validation.error);
      return;
    }

    // Salvar preferência de persistência antes de salvar a chave
    if (onPersistChange) {
      onPersistChange(localPersist);
    }

    setApiModel(selectedModel || providerDefaultModel);
    onSave(trimmedKey);
    notify.settingsSaved();
    onClose();
  };

  const handleListModels = async () => {
    const trimmedKey = key.trim();
    if (!trimmedKey) {
      notify.errorByKey("API_KEY_REQUIRED");
      return;
    }

    if (provider !== "Google AI Studio") {
      notify.warning("Listagem automática disponível apenas para Google AI Studio");
      return;
    }

    setFetchingModels(true);
    try {
      const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models", {
        headers: { "x-goog-api-key": trimmedKey },
      });

      if (!res.ok) {
        throw new Error(`Erro na API (${res.status})`);
      }

      const data = (await res.json()) as { models?: Array<{ name?: string }> };
      if (data && data.models && Array.isArray(data.models)) {
        const names = data.models
          .map((m) => (m.name || "").replace("models/", ""))
          .filter(
            (name: string) =>
              !name.includes("vision") && !name.includes("embedding"),
          );

        setFetchedModels(names);
        notify.success(`${names.length} modelos encontrados!`);
      } else {
        notify.warning("Nenhum modelo compatível encontrado");
      }
    } catch (err) {
      logger.error("ApiKeyModal", "Erro ao listar modelos", err);
      notify.errorByKey("AI_CONNECTION_FAILED");
    } finally {
      setFetchingModels(false);
    }
  };

  const handleTest = async () => {
    const trimmedKey = key.trim();
    if (!trimmedKey) {
      notify.errorByKey("API_KEY_REQUIRED");
      return;
    }
    const validation = validateApiKey(trimmedKey);
    if (!validation.success) {
      notify.error(validation.error);
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testAiConnection(trimmedKey, selectedModel || providerDefaultModel);
      setTestResult(result.success ? "success" : "error");
      if (result.success) {
        notify.success("Conexão estabelecida com sucesso!");
      } else {
        const errorMsg = result.error || "Falha na conexão";
        notify.error(`Erro: ${errorMsg}`);
      }
    } catch (err) {
      logger.error("ApiKeyModal", "Erro no teste de conexão", err);
      setTestResult("error");
      const errorMsg = err instanceof Error ? err.message : "Erro desconhecido";
      notify.error(`Erro: ${errorMsg}`);
    } finally {
      setTesting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="duplicate-modal-overlay" style={{ zIndex: 5000 }}>
      <div
        className="glass-card duplicate-modal-card"
        style={{ maxWidth: "450px", border: "1px solid var(--primary)" }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "1.5rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Key className="text-primary" size={24} color="var(--primary)" />
            <h2 style={{ color: "#fff", fontSize: "1.25rem", margin: 0 }}>
              {currentKey ? "API Key configurada" : "Configurar IA"}
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "#94a3b8",
              cursor: "pointer",
            }}
          >
            <X size={20} />
          </button>
        </div>

        <div
          style={{
            marginBottom: "1.5rem",
            background: "rgba(15, 23, 42, 0.4)",
            padding: "1rem",
            borderRadius: "12px",
            border: "1px solid rgba(255,255,255,0.05)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "12px",
            }}
          >
            <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
              Provedor detectado:
            </span>
            <span
              style={{
                fontSize: "0.75rem",
                color: "var(--primary)",
                fontWeight: "bold",
              }}
            >
              {provider}
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <label style={{ fontSize: "0.75rem", color: "#64748b" }}>
                Modelo:
              </label>
              {provider === "Google AI Studio" && (
                <button
                  onClick={handleListModels}
                  disabled={fetchingModels || !key.trim()}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--primary)",
                    fontSize: "0.7rem",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    opacity: !key.trim() ? 0.5 : 1,
                  }}
                >
                  {fetchingModels ? (
                    <RefreshCw size={12} className="spin" />
                  ) : (
                    <Cpu size={12} />
                  )}
                  Buscar modelos
                </button>
              )}
            </div>
            <select
              className="search-input"
              style={{
                width: "100%",
                background: "var(--bg-color)",
                border: "1px solid var(--card-border)",
              }}
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
            >
              {models.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ marginBottom: "1.25rem" }}>
          <label
            style={{
              display: "block",
              fontSize: "0.8rem",
              color: "#64748b",
              marginBottom: "0.5rem",
              fontWeight: "bold",
            }}
          >
            API KEY
          </label>
          <div style={{ position: "relative", marginBottom: "1rem" }}>
            <input
              type="password"
              className="search-input"
              style={{ paddingLeft: "3rem", background: "rgba(15, 23, 42, 0.4)" }}
              placeholder={provider === "Google AI Studio" ? "AIza..." : "sk-..."}
              value={key}
              onChange={(e) => {
                setKey(e.target.value);
                setTestResult(null);
              }}
            />
            <ShieldCheck
              size={18}
              style={{
                position: "absolute",
                left: "1rem",
                top: "50%",
                transform: "translateY(-50%)",
                color: "#64748b",
              }}
            />
          </div>

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              cursor: "pointer",
              padding: "8px 0",
              userSelect: "none"
            }}
          >
            <input
              type="checkbox"
              checked={localPersist}
              onChange={(e) => setLocalPersist(e.target.checked)}
              style={{
                width: "18px",
                height: "18px",
                accentColor: "var(--primary)"
              }}
            />
            <span style={{ fontSize: "0.85rem", color: "#e2e8f0" }}>
              Salvar permanentemente neste dispositivo
            </span>
          </label>
          <p style={{ fontSize: "0.7rem", color: "#64748b", marginTop: "4px", paddingLeft: "26px" }}>
            {localPersist
              ? "A chave será mantida no seu navegador mesmo após fechar o app."
              : "A chave será apagada por segurança sempre que você fechar o navegador."}
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <button
            className="btn"
            onClick={handleTest}
            disabled={testing}
            style={{
              background:
                testResult === "success"
                  ? "rgba(16, 185, 129, 0.1)"
                  : "rgba(255,255,255,0.05)",
              border:
                testResult === "success"
                  ? "1px solid var(--success)"
                  : "1px solid var(--card-border)",
              color: testResult === "success" ? "var(--success)" : "#fff",
            }}
          >
            {testing ? (
              "Testando..."
            ) : testResult === "success" ? (
              <>
                <CheckCircle size={18} /> Conexão OK
              </>
            ) : testResult === "error" ? (
              <>
                <AlertCircle size={18} /> Erro na conexão
              </>
            ) : (
              "Testar conexão"
            )}
          </button>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <button
              className="btn"
              onClick={onClose}
              style={{
                background: "transparent",
                border: "1px solid rgba(255,255,255,0.05)",
              }}
            >
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
