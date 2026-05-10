import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import { SupabaseError } from './errors'

/**
 * Configuração necessária para criar uma instância do Supabase client.
 */
export interface SupabaseConfig {
    /** URL do projeto Supabase (ex: https://xyz.supabase.co) */
    url: string
    /** Chave anônima pública do projeto Supabase */
    anonKey: string
}

/**
 * Cria e retorna uma instância do Supabase client.
 * Lança SupabaseError se url ou anonKey forem inválidos.
 *
 * @example
 * const supabase = createSupabaseClient({
 *   url: 'https://xyz.supabase.co',
 *   anonKey: 'public-anon-key'
 * })
 */
export function createSupabaseClient(config: SupabaseConfig): SupabaseClient {
    if (!config.url || !config.anonKey) {
        throw new SupabaseError(
            'INVALID_CONFIG',
            'Supabase URL e Anon Key são obrigatórios'
        )
    }

    return createClient(config.url, config.anonKey)
}