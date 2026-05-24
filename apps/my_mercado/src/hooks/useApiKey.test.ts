import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  initializeAiConfig,
  invalidateAiConfigCache,
  setConfigStore,
  type ConfigStore,
  type KeyValueStore,
} from '@bosguega/ai-core'
import { useApiKey } from './useApiKey'

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

describe('useApiKey', () => {
  it('updates provider when the key changes', async () => {
    const { result } = renderHook(() => useApiKey())

    await act(async () => {
      await result.current.setApiKey('sk-test')
    })

    expect(result.current.apiKey).toBe('sk-test')
    expect(result.current.provider).toBe('OpenAI')
    expect(result.current.hasAiConfig).toBe(true)
  })

  it('updates persistence state through ai-core', async () => {
    const { result } = renderHook(() => useApiKey())

    await act(async () => {
      await result.current.setPersistApiKey(true)
    })

    expect(result.current.persistApiKey).toBe(true)
  })

  it('supports local Ollama config without an API key', async () => {
    const { result } = renderHook(() => useApiKey())

    await act(async () => {
      await result.current.setMode('local')
      await result.current.setProvider('ollama')
      await result.current.setModel('llama3.2')
    })

    expect(result.current.provider).toBe('Ollama')
    expect(result.current.hasAiConfig).toBe(true)
  })
})
