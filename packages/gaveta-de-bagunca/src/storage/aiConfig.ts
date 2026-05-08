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

import type { ConfigStore, Provider } from './types'
import { browserStore } from './browserStore'

export type { ConfigStore, Provider }
export { browserStore }

// ------ Store singleton ------

let currentStore: ConfigStore = browserStore

const STORAGE_KEY_KEY = 'ai_key'
const STORAGE_KEY_MODEL = 'ai_model'
const STORAGE_KEY_PERSIST = 'ai_key_persist'
const DEFAULT_MODEL = 'gemini-2.0-flash'

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
    if (enabled) {
        await currentStore.preferences.set(STORAGE_KEY_PERSIST, 'true')
    } else {
        await currentStore.preferences.remove(STORAGE_KEY_PERSIST)
        await currentStore.preferences.remove(STORAGE_KEY_KEY as string)
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
    return val ?? DEFAULT_MODEL
}

export async function setApiModel(model: string): Promise<void> {
    await currentStore.preferences.set(STORAGE_KEY_MODEL, model)
}

// ------ Detecção de provedor ------

export function detectProvider(key: string | null | undefined): Provider {
    if (!key) return 'Nenhum'
    if (key.startsWith('AIza')) return 'Google AI Studio'
    if (key.startsWith('sk-')) return 'OpenAI'
    return 'Desconhecido'
}

// ------ Helpers ------

export async function hasApiKey(): Promise<boolean> {
    const key = await getApiKey()
    return !!key && key.length > 0
}