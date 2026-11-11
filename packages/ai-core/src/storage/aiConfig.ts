/**
 * AI Configuration — configurações independentes para IA online e local.
 */
import { DEFAULT_BASE_URL as DEFAULT_LLAMA_CPP_BASE_URL } from '@bosguega/llama-cpp'
import type { AIProvider, AIMode, ConfigStore, Provider } from './types'
import { browserStore } from './browserStore'

export type { ConfigStore, Provider }
export { browserStore }
let currentStore: ConfigStore = browserStore

const STORAGE_KEY_KEY = 'ai_key'
const STORAGE_KEY_MODEL = 'ai_model' // modelo online legado/atual
const STORAGE_KEY_LOCAL_MODEL = 'ai_local_model'
const STORAGE_KEY_PERSIST = 'ai_key_persist'
const STORAGE_KEY_MODE = 'ai_mode'
const STORAGE_KEY_PROVIDER = 'ai_provider'
const STORAGE_KEY_BASE_URL = 'ai_base_url'
export const DEFAULT_AI_MODEL = 'gemini-1.5-flash-lite'
export const DEFAULT_AI_MODE: AIMode = 'online'
export const DEFAULT_AI_PROVIDER: AIProvider = 'gemini'
export const DEFAULT_AI_BASE_URL = DEFAULT_LLAMA_CPP_BASE_URL

export function setConfigStore(store: ConfigStore): void { currentStore = store }
export function getConfigStore(): ConfigStore { return currentStore }

export async function isPersistenceEnabled(): Promise<boolean> {
    return (await currentStore.preferences.get(STORAGE_KEY_PERSIST)) === 'true'
}
export async function setPersistenceEnabled(enabled: boolean): Promise<void> {
    const currentKey = await getApiKey()
    if (enabled) await currentStore.preferences.set(STORAGE_KEY_PERSIST, 'true')
    else {
        await currentStore.preferences.remove(STORAGE_KEY_PERSIST)
        await currentStore.preferences.remove(STORAGE_KEY_KEY)
    }
    if (currentKey) await setApiKey(currentKey)
}

export async function getApiKey(): Promise<string | null> {
    return (await isPersistenceEnabled())
        ? currentStore.preferences.get(STORAGE_KEY_KEY)
        : currentStore.apiKey.get(STORAGE_KEY_KEY)
}
export async function setApiKey(key: string | null | undefined): Promise<void> {
    const trimmed = key?.trim() ?? ''
    if (await isPersistenceEnabled()) {
        if (trimmed) await currentStore.preferences.set(STORAGE_KEY_KEY, trimmed)
        else await currentStore.preferences.remove(STORAGE_KEY_KEY)
    }
    if (trimmed) await currentStore.apiKey.set(STORAGE_KEY_KEY, trimmed)
    else await currentStore.apiKey.remove(STORAGE_KEY_KEY)
}
export async function clearApiKey(): Promise<void> { await setApiKey(null) }

/** Modelo online. Mantém a chave histórica ai_model para não quebrar serviços existentes. */
export async function getApiModel(): Promise<string> {
    const val = await currentStore.preferences.get(STORAGE_KEY_MODEL)
    const legacyProvider = await currentStore.preferences.get(STORAGE_KEY_PROVIDER)
    // Em instalações antigas, ai_model podia conter o modelo Ollama.
    if (legacyProvider === 'ollama' && !(await currentStore.preferences.get(STORAGE_KEY_LOCAL_MODEL))) {
        return DEFAULT_AI_MODEL
    }
    return val ?? DEFAULT_AI_MODEL
}
export async function setApiModel(model: string): Promise<void> {
    await currentStore.preferences.set(STORAGE_KEY_MODEL, model)
}

/** Modelo local, migrando o modelo Ollama antigo apenas uma vez e sem o descartar. */
export async function getAiLocalModel(): Promise<string> {
    const stored = await currentStore.preferences.get(STORAGE_KEY_LOCAL_MODEL)
    if (stored) return stored
    const legacyProvider = await currentStore.preferences.get(STORAGE_KEY_PROVIDER)
    const legacyModel = await currentStore.preferences.get(STORAGE_KEY_MODEL)
    if (legacyProvider === 'ollama' && legacyModel?.trim()) {
        await currentStore.preferences.set(STORAGE_KEY_LOCAL_MODEL, legacyModel)
        return legacyModel
    }
    return ''
}
export async function setAiLocalModel(model: string): Promise<void> {
    const trimmed = model.trim()
    if (trimmed) await currentStore.preferences.set(STORAGE_KEY_LOCAL_MODEL, trimmed)
    else await currentStore.preferences.remove(STORAGE_KEY_LOCAL_MODEL)
}

export async function getAiMode(): Promise<AIMode> {
    return (await currentStore.preferences.get(STORAGE_KEY_MODE)) === 'local' ? 'local' : DEFAULT_AI_MODE
}
export async function setAiMode(mode: AIMode): Promise<void> {
    await currentStore.preferences.set(STORAGE_KEY_MODE, mode)
}
export async function getAiProvider(): Promise<AIProvider> {
    const val = await currentStore.preferences.get(STORAGE_KEY_PROVIDER)
    if (val === 'ollama') return 'llama-cpp' // migração transparente do provedor local legado
    if (val === 'gemini' || val === 'openai' || val === 'llama-cpp') return val
    return DEFAULT_AI_PROVIDER
}
export async function setAiProvider(provider: AIProvider): Promise<void> {
    await currentStore.preferences.set(STORAGE_KEY_PROVIDER, provider === 'ollama' ? 'llama-cpp' : provider)
}
export async function getAiBaseUrl(): Promise<string> {
    const val = (await currentStore.preferences.get(STORAGE_KEY_BASE_URL))?.trim()
    // URL padrão antiga do Ollama não é válida para llama-server.
    if (!val || val === 'http://localhost:11434' || val === 'http://127.0.0.1:11434') return DEFAULT_AI_BASE_URL
    return val
}
export async function setAiBaseUrl(baseUrl: string | null | undefined): Promise<void> {
    const trimmed = baseUrl?.trim() ?? ''
    if (trimmed) await currentStore.preferences.set(STORAGE_KEY_BASE_URL, trimmed)
    else await currentStore.preferences.remove(STORAGE_KEY_BASE_URL)
}

export function detectProvider(key: string | null | undefined): Provider {
    const trimmed = key?.trim()
    if (!trimmed) return 'none'
    if (trimmed.startsWith('AIza')) return 'gemini'
    if (trimmed.startsWith('sk-') || trimmed.startsWith('sk_')) return 'openai'
    return 'unknown'
}
export async function hasApiKey(): Promise<boolean> {
    const key = await getApiKey()
    return !!key && key.length > 0
}
export async function hasAiConfig(): Promise<boolean> {
    if (await getAiMode() === 'local') {
        return (await getAiProvider()) === 'llama-cpp' && !!(await getAiLocalModel()).trim()
    }
    return hasApiKey()
}
