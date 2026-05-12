import { afterEach, describe, expect, it } from 'vitest'
import { createAiClient } from './createAiClient'
import {
    initializeAiConfig,
    invalidateAiConfigCache,
    setApiKey,
    setConfigStore,
    setApiModel,
} from '../storage'
import type { ConfigStore, KeyValueStore } from '../storage'

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

describe('createAiClient', () => {
    it('creates a Gemini client from a Gemini key', async () => {
        setConfigStore(createStore())
        await setApiKey('AIza-test')
        await setApiModel('gemini-test')
        await initializeAiConfig()

        const client = createAiClient({ retry: false })
        expect(client).toEqual(expect.objectContaining({
            generateText: expect.any(Function),
            testConnection: expect.any(Function),
        }))
    })

    it('creates an OpenAI client from an OpenAI key without calling it during construction', () => {
        const client = createAiClient({ apiKey: 'sk-test', model: 'gpt-test', retry: false })
        expect(client).toEqual(expect.objectContaining({
            generateText: expect.any(Function),
            testConnection: expect.any(Function),
        }))
    })

    it('rejects unknown providers', () => {
        expect(() => createAiClient({ apiKey: 'abc', model: 'model', retry: false }))
            .toThrow('Provider de IA nao suportado')
    })
})
