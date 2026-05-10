/**
 * Storage Interfaces — Gaveta de Bagunça
 *
 * Interfaces agnósticas para armazenamento de chave/valor.
 * Permitem injetar implementações diferentes dependendo do ambiente:
 * - Browser: sessionStorage / localStorage
 * - Tauri: arquivo JSON no sistema
 * - React Native: AsyncStorage
 * - Node.js: arquivo no disco
 */

export interface KeyValueStore {
    get(key: string): Promise<string | null>
    set(key: string, value: string): Promise<void>
    remove(key: string): Promise<void>
}

export interface ConfigStore {
    /** Armazenamento para dados sensíveis (API key).
     *  No browser padrão: sessionStorage.
     */
    apiKey: KeyValueStore

    /** Armazenamento para preferências não sensíveis (modelo, persistência).
     *  No browser padrão: localStorage.
     */
    preferences: KeyValueStore
}

/** Provedores de IA detectados pelo prefixo da chave */
export type Provider = 'Google AI Studio' | 'OpenAI' | 'Nenhum' | 'Desconhecido'