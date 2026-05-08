/**
 * AI Configuration Storage
 *
 * Gerencia o armazenamento da API key e modelo selecionado.
 * Usa sessionStorage por padrão (limpa ao fechar a aba).
 * Permite opcionalmente persistir em localStorage entre sessões.
 *
 * O modelo selecionado (sem dados sensíveis) é sempre salvo em localStorage.
 * Framework-agnostic — funciona em qualquer app (React, Vue, vanilla TS).
 */

const STORAGE_KEY_KEY = 'ai_key'
const STORAGE_KEY_MODEL = 'ai_model'
const STORAGE_KEY_PERSIST = 'ai_key_persist'

function getStorage(type: 'session' | 'local'): Storage | null {
    if (typeof window === 'undefined') return null
    return type === 'session' ? window.sessionStorage : window.localStorage
}

// ------ Persistência ------

/**
 * Verifica se a persistência da chave está ativa.
 */
export function isPersistenceEnabled(): boolean {
    const local = getStorage('local')
    return local?.getItem(STORAGE_KEY_PERSIST) === 'true'
}

/**
 * Ativa ou desativa a persistência da chave entre sessões.
 * Se desativar, remove a chave do localStorage.
 */
export function setPersistenceEnabled(enabled: boolean): void {
    const local = getStorage('local')
    if (!local) return

    if (enabled) {
        local.setItem(STORAGE_KEY_PERSIST, 'true')
    } else {
        local.removeItem(STORAGE_KEY_PERSIST)
        local.removeItem(STORAGE_KEY_KEY)
    }
}

// ------ API Key ------

/**
 * Recupera a API Key do storage apropriado.
 * Se a persistência está ativa, busca no localStorage.
 * Caso contrário, busca no sessionStorage.
 */
export function getApiKey(): string | null {
    const persist = isPersistenceEnabled()

    if (persist) {
        const local = getStorage('local')
        return local?.getItem(STORAGE_KEY_KEY) ?? null
    }

    const session = getStorage('session')
    return session?.getItem(STORAGE_KEY_KEY) ?? null
}

/**
 * Salva a API Key.
 * Se a persistência está ativa, salva no localStorage.
 * Sempre salva também no sessionStorage (redundância).
 */
export function setApiKey(key: string | null | undefined): void {
    const trimmed = key?.trim() ?? ''
    const persist = isPersistenceEnabled()

    if (persist) {
        const local = getStorage('local')
        if (local) {
            if (trimmed) {
                local.setItem(STORAGE_KEY_KEY, trimmed)
            } else {
                local.removeItem(STORAGE_KEY_KEY)
            }
        }
    }

    // Sempre salva na sessão também
    const session = getStorage('session')
    if (session) {
        if (trimmed) {
            session.setItem(STORAGE_KEY_KEY, trimmed)
        } else {
            session.removeItem(STORAGE_KEY_KEY)
        }
    }
}

/**
 * Remove a API Key de ambos os storages.
 */
export function clearApiKey(): void {
    setApiKey(null)
}

// ------ Modelo ------

const DEFAULT_MODEL = 'gemini-2.0-flash'

/**
 * Recupera o modelo salvo (persiste entre sessões — não é dado sensível).
 */
export function getApiModel(): string {
    const local = getStorage('local')
    return local?.getItem(STORAGE_KEY_MODEL) ?? DEFAULT_MODEL
}

/**
 * Salva o modelo selecionado no localStorage.
 */
export function setApiModel(model: string): void {
    const local = getStorage('local')
    local?.setItem(STORAGE_KEY_MODEL, model)
}

// ------ Detecção de provedor ------

export type Provider = 'Google AI Studio' | 'OpenAI' | 'Nenhum' | 'Desconhecido'

/**
 * Detecta o provedor de IA com base no prefixo da chave.
 */
export function detectProvider(key: string | null | undefined): Provider {
    if (!key) return 'Nenhum'
    if (key.startsWith('AIza')) return 'Google AI Studio'
    if (key.startsWith('sk-')) return 'OpenAI'
    return 'Desconhecido'
}

// ------ Helpers ------

/**
 * Verifica se uma chave de API está configurada.
 */
export function hasApiKey(): boolean {
    const key = getApiKey()
    return !!key && key.length > 0
}