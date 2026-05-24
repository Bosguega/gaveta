import { beforeEach, describe, expect, it } from 'vitest'
import {
  initializeAiConfig,
  invalidateAiConfigCache,
  setAiMode as coreSetAiMode,
  setAiProvider as coreSetAiProvider,
  setApiKey as coreSetApiKey,
  setConfigStore,
  type ConfigStore,
  type KeyValueStore,
} from '@bosguega/ai-core'
import {
  detectProvider,
  getAiMode,
  getAiProvider,
  hasAiConfig,
  getApiKey,
  isPersistenceEnabled,
  setApiKey,
  setPersistenceEnabled,
} from './aiConfig'

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

beforeEach(async () => {
  setConfigStore(createStore())
  invalidateAiConfigCache()
  await initializeAiConfig()
})

describe('app aiConfig adapter', () => {
  it('keeps UI provider labels outside ai-core', () => {
    expect(detectProvider('AIza-test')).toBe('Google AI Studio')
    expect(detectProvider('sk-test')).toBe('OpenAI')
    expect(detectProvider(null)).toBe('Nenhum')
    expect(detectProvider('abc')).toBe('Desconhecido')
  })

  it('refreshes the sync cache after saving an api key', async () => {
    await setApiKey('sk-test')

    expect(getApiKey()).toBe('sk-test')
  })

  it('reads persistence from the core cache', async () => {
    await coreSetApiKey('AIza-test')
    await setPersistenceEnabled(true)

    expect(isPersistenceEnabled()).toBe(true)
    expect(getApiKey()).toBe('AIza-test')
  })

  it('reads mode/provider labels from the core cache', async () => {
    await coreSetAiMode('local')
    await coreSetAiProvider('ollama')
    invalidateAiConfigCache()
    await initializeAiConfig()

    expect(getAiMode()).toBe('local')
    expect(getAiProvider()).toBe('ollama')
    expect(hasAiConfig()).toBe(true)
  })
})
