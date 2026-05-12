/**
 * Browser Store — Implementação padrão do ConfigStore
 *
 * Usa sessionStorage para API key (limpa ao fechar a aba)
 * e localStorage para preferências (persiste entre sessões).
 *
 * Funciona em qualquer app web (React, Vue, vanilla TS).
 */

import type { ConfigStore, KeyValueStore } from './types'

class MemoryStore implements KeyValueStore {
    private values = new Map<string, string>()

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

class WebStorageAdapter implements KeyValueStore {
    private storage: Storage

    constructor(storage: Storage) {
        this.storage = storage
    }

    async get(key: string): Promise<string | null> {
        return this.storage.getItem(key)
    }

    async set(key: string, value: string): Promise<void> {
        this.storage.setItem(key, value)
    }

    async remove(key: string): Promise<void> {
        this.storage.removeItem(key)
    }
}

function createStorageAdapter(kind: 'sessionStorage' | 'localStorage'): KeyValueStore {
    if (typeof window === 'undefined') {
        return new MemoryStore()
    }

    return new WebStorageAdapter(window[kind])
}

export const browserStore: ConfigStore = {
    apiKey: createStorageAdapter('sessionStorage'),
    preferences: createStorageAdapter('localStorage'),
}
