/**
 * AI Configuration
 *
 * Gerencia a API key e modelo selecionado.
 * Usa um ConfigStore injetável — por padrão usa o browserStore
 * (sessionStorage + localStorage), mas pode ser substituído para
 * ambientes como Tauri, React Native, Node.js, etc.
 *
 * Framework-agnostic — funciona em qualquer app.
 */

import { DEFAULT_OLLAMA_BASE_URL } from '../ollama'
import type { AIProvider, AIMode, ConfigStore, Provider } from './types'
import { browserStore } from './browserStore'

export type { ConfigStore, Provider }
export { browserStore }

// ------ Store singleton ------

let currentStore: ConfigStore = browserStore

const STORAGE_KEY_KEY = 'ai_key'
const STORAGE_KEY_MODEL = 'ai_model'
const STORAGE_KEY_PERSIST = 'ai_key_persist'
const STORAGE_KEY_MODE = 'ai_mode'
const STORAGE_KEY_PROVIDER = 'ai_provider'
const STORAGE_KEY_BASE_URL = 'ai_base_url'
export const DEFAULT_AI_MODEL = 'gemini-1.5-flash-lite'
export const DEFAULT_AI_MODE: AIMode = 'online'
export const DEFAULT_AI_PROVIDER: AIProvider = 'gemini'
export const DEFAULT_AI_BASE_URL = DEFAULT_OLLAMA_BASE_URL

/**
 * Substitui o ConfigStore ativo.
 * Permite injetar um store para Tauri, React Native, etc.
 */
export function setConfigStore(store: ConfigStore): void {
    currentStore = store
}

/**
 * Retorna o ConfigStore ativo.
 */
export function getConfigStore(): ConfigStore {
    return currentStore
}

// ------ Persistência ------

export async function isPersistenceEnabled(): Promise<boolean> {
    const val = await currentStore.preferences.get(STORAGE_KEY_PERSIST)
    return val === 'true'
}

export async function setPersistenceEnabled(enabled: boolean): Promise<void> {
    const currentKey = await getApiKey()

    if (enabled) {
        await currentStore.preferences.set(STORAGE_KEY_PERSIST, 'true')
    } else {
        await currentStore.preferences.remove(STORAGE_KEY_PERSIST)
        await currentStore.preferences.remove(STORAGE_KEY_KEY)
    }

    if (currentKey) {
        await setApiKey(currentKey)
    }
}

// ------ API Key ------

export async function getApiKey(): Promise<string | null> {
    const persist = await isPersistenceEnabled()

    if (persist) {
        return currentStore.preferences.get(STORAGE_KEY_KEY)
    }

    return currentStore.apiKey.get(STORAGE_KEY_KEY)
}

export async function setApiKey(key: string | null | undefined): Promise<void> {
    const trimmed = key?.trim() ?? ''
    const persist = await isPersistenceEnabled()

    if (persist) {
        if (trimmed) {
            await currentStore.preferences.set(STORAGE_KEY_KEY, trimmed)
        } else {
            await currentStore.preferences.remove(STORAGE_KEY_KEY)
        }
    }

    // Sempre salva na sessão também
    if (trimmed) {
        await currentStore.apiKey.set(STORAGE_KEY_KEY, trimmed)
    } else {
        await currentStore.apiKey.remove(STORAGE_KEY_KEY)
    }
}

export async function clearApiKey(): Promise<void> {
    await setApiKey(null)
}

// ------ Modelo ------

export async function getApiModel(): Promise<string> {
    const val = await currentStore.preferences.get(STORAGE_KEY_MODEL)
    return val ?? DEFAULT_AI_MODEL
}

export async function setApiModel(model: string): Promise<void> {
    await currentStore.preferences.set(STORAGE_KEY_MODEL, model)
}

export async function getAiMode(): Promise<AIMode> {
    const val = await currentStore.preferences.get(STORAGE_KEY_MODE)
    return val === 'local' ? 'local' : DEFAULT_AI_MODE
}

export async function setAiMode(mode: AIMode): Promise<void> {
    await currentStore.preferences.set(STORAGE_KEY_MODE, mode)
}

export async function getAiProvider(): Promise<AIProvider> {
    const val = await currentStore.preferences.get(STORAGE_KEY_PROVIDER)
    if (val === 'gemini' || val === 'openai' || val === 'ollama') return val
    return DEFAULT_AI_PROVIDER
}

export async function setAiProvider(provider: AIProvider): Promise<void> {
    await currentStore.preferences.set(STORAGE_KEY_PROVIDER, provider)
}

export async function getAiBaseUrl(): Promise<string> {
    const val = await currentStore.preferences.get(STORAGE_KEY_BASE_URL)
    return val?.trim() || DEFAULT_AI_BASE_URL
}

export async function setAiBaseUrl(baseUrl: string | null | undefined): Promise<void> {
    const trimmed = baseUrl?.trim() ?? ''
    if (trimmed) {
        await currentStore.preferences.set(STORAGE_KEY_BASE_URL, trimmed)
    } else {
        await currentStore.preferences.remove(STORAGE_KEY_BASE_URL)
    }
}

// ------ Detecção de provedor ------

export function detectProvider(key: string | null | undefined): Provider {
    const trimmed = key?.trim()
    if (!trimmed) return 'none'
    if (trimmed.startsWith('AIza')) return 'gemini'
    if (trimmed.startsWith('sk-') || trimmed.startsWith('sk_')) return 'openai'
    return 'unknown'
}

// ------ Helpers ------

export async function hasApiKey(): Promise<boolean> {
    const key = await getApiKey()
    return !!key && key.length > 0
}

export async function hasAiConfig(): Promise<boolean> {
    const mode = await getAiMode()
    if (mode === 'local') {
        const provider = await getAiProvider()
        const model = await getApiModel()
        return provider === 'ollama' && model.trim().length > 0
    }

    return hasApiKey()
}
