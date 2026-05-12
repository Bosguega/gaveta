import { afterEach, describe, expect, it } from 'vitest'
import {
    clearApiKey,
    detectProvider,
    getApiKey,
    getApiModel,
    initializeAiConfig,
    invalidateAiConfigCache,
    isPersistenceEnabled,
    isPersistenceEnabledCached,
    setApiKey,
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

    it('hydrates persistence into the sync cache', async () => {
        const store = createStore()
        setConfigStore(store)

        await setPersistenceEnabled(true)
        await initializeAiConfig()

        expect(await isPersistenceEnabled()).toBe(true)
        expect(isPersistenceEnabledCached()).toBe(true)
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
