/**
 * Browser Store — Implementação padrão do ConfigStore
 *
 * Usa sessionStorage para API key (limpa ao fechar a aba)
 * e localStorage para preferências (persiste entre sessões).
 *
 * Funciona em qualquer app web (React, Vue, vanilla TS).
 */

import type { ConfigStore, KeyValueStore } from './types'

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

export const browserStore: ConfigStore = {
    apiKey: new WebStorageAdapter(
        typeof window !== 'undefined' ? window.sessionStorage : ({} as Storage)
    ),
    preferences: new WebStorageAdapter(
        typeof window !== 'undefined' ? window.localStorage : ({} as Storage)
    ),
}