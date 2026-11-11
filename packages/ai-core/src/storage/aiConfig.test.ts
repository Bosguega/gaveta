import { afterEach, describe, expect, it } from 'vitest'
import {
    clearApiKey,
    detectProvider,
    getApiKey,
    getAiBaseUrl,
    getAiMode,
    getAiModeCached,
    getAiProvider,
    getAiProviderCached,
    getApiModel,
    setApiModel,
    getAiLocalModel,
    setAiLocalModel,
    hasAiConfig,
    hasAiConfigCached,
    initializeAiConfig,
    invalidateAiConfigCache,
    isPersistenceEnabled,
    isPersistenceEnabledCached,
    setApiKey,
    setAiBaseUrl,
    setAiMode,
    setAiProvider,
    setConfigStore,
    setPersistenceEnabled,
} from './index'
import type { ConfigStore, KeyValueStore } from './types'

class MemoryStore implements KeyValueStore {
    values = new Map<string, string>()

    async get(key: string): Promise<string | null> {
        return this.values.get(key) ?? null
    }

    async set(key: string, value: string): Promise<void> {
        this.values.set(key, value)
    }

    async remove(key: string): Promise<void> {
        this.values.delete(key)
    }
}

function createStore(): ConfigStore {
    return {
        apiKey: new MemoryStore(),
        preferences: new MemoryStore(),
    }
}

afterEach(() => {
    setConfigStore(createStore())
    invalidateAiConfigCache()
})

describe('ai config', () => {
    it('detects canonical providers from key prefixes', () => {
        expect(detectProvider('AIza-test')).toBe('gemini')
        expect(detectProvider('sk-test')).toBe('openai')
        expect(detectProvider('sk_test')).toBe('openai')
        expect(detectProvider('')).toBe('none')
        expect(detectProvider('abc')).toBe('unknown')
    })

    it('uses a single default model', async () => {
        setConfigStore(createStore())

        expect(await getApiModel()).toBe('gemini-1.5-flash-lite')
    })

    it('uses online mode and Gemini provider defaults', async () => {
        setConfigStore(createStore())

        expect(await getAiMode()).toBe('online')
        expect(await getAiProvider()).toBe('gemini')
        expect(await getAiBaseUrl()).toBe('http://127.0.0.1:8080')
    })

    it('hydrates persistence into the sync cache', async () => {
        const store = createStore()
        setConfigStore(store)

        await setPersistenceEnabled(true)
        await initializeAiConfig()

        expect(await isPersistenceEnabled()).toBe(true)
        expect(isPersistenceEnabledCached()).toBe(true)
    })

    it('hydrates local provider config into the sync cache', async () => {
        setConfigStore(createStore())

        await setAiMode('local')
        await setAiProvider('ollama')
        await setAiLocalModel('bonsai')
        await setAiBaseUrl('http://127.0.0.1:11434')
        await initializeAiConfig()

        expect(getAiModeCached()).toBe('local')
        expect(getAiProviderCached()).toBe('llama-cpp')
        expect(hasAiConfigCached()).toBe(true)
        expect(await getAiLocalModel()).toBe('bonsai')
        expect(await hasAiConfig()).toBe(true)
    })

    it('keeps online and local models independent and migrates legacy Ollama settings', async () => {
        const store = createStore()
        setConfigStore(store)
        await setApiKey('AIza-preserved')
        await setApiModel('gemini-model')
        await store.preferences.set('ai_provider', 'ollama')
        await store.preferences.set('ai_model', 'bonsai-old')
        await store.preferences.set('ai_base_url', 'http://127.0.0.1:11434')

        expect(await getApiModel()).toBe('gemini-1.5-flash-lite')
        expect(await getAiLocalModel()).toBe('bonsai-old')
        expect(await getAiProvider()).toBe('llama-cpp')
        expect(await getAiBaseUrl()).toBe('http://127.0.0.1:8080')
        expect(await getApiKey()).toBe('AIza-preserved')
    })

    it('keeps online and local model selections separate', async () => {
        setConfigStore(createStore())
        await setApiModel('gemini-pro')
        await setAiLocalModel('bonsai')
        expect(await getApiModel()).toBe('gemini-pro')
        expect(await getAiLocalModel()).toBe('bonsai')
    })

    it('moves the current key when persistence changes', async () => {
        setConfigStore(createStore())

        await setApiKey('AIza-session')
        await setPersistenceEnabled(true)
        expect(await getApiKey()).toBe('AIza-session')

        await clearApiKey()
        expect(await getApiKey()).toBeNull()
    })
})
