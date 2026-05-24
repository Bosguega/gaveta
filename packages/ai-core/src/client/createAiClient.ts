/**
 * createAiClient
 *
 * Fachada sync para criar um ProviderClient configurado.
 * Requer que initializeAiConfig() tenha sido chamado antes (para cache populado).
 *
 * Uso típico:
 *   const ai = createAiClient()
 *   const result = await ai.generateText({ userPrompt: '...' })
 */

import { createGeminiClient } from '../gemini/createGeminiClient'
import { createOllamaClient, DEFAULT_OLLAMA_BASE_URL } from '../ollama'
import { createOpenAiClient } from '../openai/createOpenAiClient'
import { withRetry } from './retryWrapper'
import { withFallback } from './fallbackWrapper'
import { getApiKeyCached, getApiModelCached } from '../storage/cache'
import { detectProvider } from '../storage/aiConfig'
import type { ProviderClient, ProviderName } from './types'

export interface CreateAiClientOptions {
    /** API key explícita. Se não informada, usa a do cache. */
    apiKey?: string
    /** Provider explícito. Se não informado, detecta pela chave. */
    provider?: ProviderName
    /** Modelo explícito. Se não informado, usa o salvo no storage. */
    model?: string
    /** URL base para providers locais HTTP, como Ollama. */
    baseUrl?: string
    /** ProviderClient primário para fallback (uso avançado). */
    primary?: ProviderClient
    /** ProviderClient secundário para fallback. */
    secondary?: ProviderClient
    /** Configuração de retry. Passar false desabilita retry. */
    retry?: { maxRetries?: number; delayMs?: number } | false
}

/**
 * Cria um ProviderClient configurado com base no cache.
 *
 * Sync — obtém API key e modelo do cache (populado por initializeAiConfig()).
 *
 * Pipeline:
 *   1. Seleciona provider (gemini/openai) baseado na chave ou opção explícita
 *   2. Cria o client base do provider
 *   3. Aplica retry wrapper (a menos que desabilitado)
 *   4. Aplica fallback wrapper (se primary/secondary forem fornecidos)
 */
export function createAiClient(options?: CreateAiClientOptions): ProviderClient {
    const explicitProvider = options?.provider
    const apiKey = explicitProvider === 'ollama'
        ? options?.apiKey
        : options?.apiKey ?? getApiKeyCached()
    const model = options?.model ?? getApiModelCached()
    const provider = explicitProvider ?? detectProvider(apiKey)

    if (provider !== 'ollama' && !apiKey) {
        throw new Error(
            'API Key não configurada. Acesse as configurações para informar sua chave.'
        )
    }

    // 1. Cria o client base do provider
    let client: ProviderClient

    if (options?.primary && options?.secondary) {
        // Modo fallback explícito
        client = options.primary
    } else {
        if (provider === 'openai') {
            client = createOpenAiClient(apiKey ?? '', model)
        } else if (provider === 'gemini') {
            client = createGeminiClient(apiKey ?? '', model)
        } else if (provider === 'ollama') {
            client = createOllamaClient(model, options?.baseUrl ?? DEFAULT_OLLAMA_BASE_URL)
        } else {
            throw new Error('Provider de IA nao suportado para a chave informada.')
        }
    }

    // 2. Aplica retry (a menos que desabilitado)
    if (options?.retry !== false) {
        client = withRetry(client, options?.retry ?? undefined)
    }

    // 3. Aplica fallback (se configurado)
    if (options?.primary && options?.secondary) {
        client = withFallback(client, options.secondary)
    }

    return client
}
