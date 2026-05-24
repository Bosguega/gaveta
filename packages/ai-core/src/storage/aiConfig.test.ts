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
        expect(await getAiBaseUrl()).toBe('http://localhost:11434')
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
        await setAiBaseUrl('http://127.0.0.1:11434')
        await initializeAiConfig()

        expect(getAiModeCached()).toBe('local')
        expect(getAiProviderCached()).toBe('ollama')
        expect(hasAiConfigCached()).toBe(true)
        expect(await hasAiConfig()).toBe(true)
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
