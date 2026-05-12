/**
 * AI Config Cache
 *
 * Camada de cache sync para acesso rápido após bootstrap.
 *
 * O core mantém funções async para flexibilidade (Tauri, Node, etc.),
 * mas esta camada permite consumo sync no React após uma inicialização única.
 *
 * Uso:
 *   await initializeAiConfig()
 *   const key = getApiKeyCached()  // sync!
 */

import { DEFAULT_AI_MODEL, detectProvider, getApiKey, getApiModel, isPersistenceEnabled } from './aiConfig'
import type { Provider } from './types'

// ------ Estado interno ------

let _key: string | null = null
let _model: string | null = null
let _persist = false
let _initialized = false

// ------ Bootstrap ------

/**
 * Inicializa o cache lendo as configurações do store ativo.
 * Deve ser chamado uma vez no bootstrap do app.
 */
export async function initializeAiConfig(): Promise<void> {
    if (_initialized) return
    _key = await getApiKey()
    _model = await getApiModel()
    _persist = await isPersistenceEnabled()
    _initialized = true
}

// ------ Getters sync (após bootstrap) ------

/**
 * Retorna a API key do cache.
 * Requer que initializeAiConfig() tenha sido chamado antes.
 */
export function getApiKeyCached(): string | null {
    assertInitialized()
    return _key
}

/**
 * Retorna o modelo do cache.
 * Requer que initializeAiConfig() tenha sido chamado antes.
 */
export function getApiModelCached(): string {
    assertInitialized()
    return _model ?? DEFAULT_AI_MODEL
}

export function isPersistenceEnabledCached(): boolean {
    assertInitialized()
    return _persist
}

/**
 * Detecta o provider baseado na chave cacheada.
 * Requer que initializeAiConfig() tenha sido chamado antes.
 */
export function detectProviderCached(): Provider {
    assertInitialized()
    return detectProvider(_key)
}

/**
 * Verifica se há chave configurada.
 * Requer que initializeAiConfig() tenha sido chamado antes.
 */
export function hasApiKeyCached(): boolean {
    assertInitialized()
    return !!_key && _key.length > 0
}

// ------ Invalidação de cache ------

/**
 * Invalida o cache forçando uma releitura na próxima inicialização.
 * Útil após salvar/alterar API key ou modelo.
 */
export function invalidateAiConfigCache(): void {
    _key = null
    _model = null
    _persist = false
    _initialized = false
}

// ------ Helpers internos ------

function assertInitialized(): void {
    if (!_initialized) {
        throw new Error(
            'ai-core não inicializado. Execute await initializeAiConfig() ' +
            'antes de usar getters cacheados.'
        )
    }
}
