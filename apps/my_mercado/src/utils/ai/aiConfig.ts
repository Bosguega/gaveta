/**
 * AI Configuration Utils
 *
 * Gerencia o armazenamento da API key.
 * Por padrão, usa sessionStorage (limpa ao fechar a aba) para maior segurança.
 * Permite opcionalmente salvar em localStorage para persistência entre sessões.
 *
 * O modelo selecionado (sem dados sensíveis) é sempre salvo em localStorage.
 */

const SESSION_KEY = "ai_key";
const MODEL_KEY = "ai_model";
const PERSIST_KEY = "ai_key_persist"; // Flag para saber se deve persistir no localStorage

function getStorage(type: "session" | "local"): Storage | null {
  if (typeof window === "undefined") return null;
  return type === "session" ? window.sessionStorage : window.localStorage;
}

/**
 * Verifica se a persistência está ativa.
 */
export function isPersistenceEnabled(): boolean {
  const local = getStorage("local");
  return local?.getItem(PERSIST_KEY) === "true";
}

/**
 * Define se a chave deve ser persistida ou não.
 */
export function setPersistenceEnabled(enabled: boolean) {
  const local = getStorage("local");
  if (!local) return;

  if (enabled) {
    local.setItem(PERSIST_KEY, "true");
  } else {
    local.removeItem(PERSIST_KEY);
    // Se desativar, remove a chave do localStorage se ela existir lá
    local.removeItem(SESSION_KEY);
  }
}

/**
 * Recupera a API Key.
 * Tenta buscar no local apropriado baseado na preferência de persistência.
 */
export function getApiKey(): string | null {
  const persist = isPersistenceEnabled();

  if (persist) {
    const local = getStorage("local");
    return local?.getItem(SESSION_KEY) || null;
  }

  const session = getStorage("session");
  return session?.getItem(SESSION_KEY) || null;
}

/**
 * Salva a API Key no local configurado.
 */
export function setApiKey(key: string | null | undefined) {
  const persist = isPersistenceEnabled();
  const trimmedKey = key?.trim();

  if (persist) {
    const local = getStorage("local");
    if (local) {
      if (trimmedKey) {
        local.setItem(SESSION_KEY, trimmedKey);
      } else {
        local.removeItem(SESSION_KEY);
      }
    }
  }

  // Sempre tenta salvar na sessão também (redundância/facilidade)
  const session = getStorage("session");
  if (session) {
    if (trimmedKey) {
      session.setItem(SESSION_KEY, trimmedKey);
    } else {
      session.removeItem(SESSION_KEY);
    }
  }
}

/**
 * Recupera o modelo salvo (persiste entre sessões — não é dado sensível).
 */
export function getApiModel(): string {
  const local = getStorage("local");
  return local?.getItem(MODEL_KEY) || "gemini-1.5-flash-lite";
}

/**
 * Salva o modelo selecionado no localStorage.
 */
export function setApiModel(model: string) {
  const local = getStorage("local");
  local?.setItem(MODEL_KEY, model);
}

/**
 * Detecta o provedor AI com base no prefixo da chave.
 */
export function detectProvider(key: string | null | undefined): string {
  if (!key) return "Nenhum";
  if (key.startsWith("AIza")) return "Google AI Studio";
  if (key.startsWith("sk-")) return "OpenAI";
  return "Desconhecido";
}
