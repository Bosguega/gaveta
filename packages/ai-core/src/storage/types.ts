/**
 * Storage Interfaces — Gaveta de Bagunça
 */
export interface KeyValueStore {
    get(key: string): Promise<string | null>
    set(key: string, value: string): Promise<void>
    remove(key: string): Promise<void>
}

export interface ConfigStore {
    apiKey: KeyValueStore
    preferences: KeyValueStore
}

export type AIMode = 'online' | 'local'
/** Provider ids canonicos. Ollama permanece apenas para compatibilidade legada. */
export type AIProvider = 'gemini' | 'openai' | 'ollama' | 'llama-cpp'
export type Provider = AIProvider | 'none' | 'unknown'
