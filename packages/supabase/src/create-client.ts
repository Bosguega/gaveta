import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient, SupabaseClientOptions } from '@supabase/supabase-js'
import { SupabaseError } from './errors'

export interface SupabaseConfig {
    /** URL do projeto Supabase. */
    url: string
    /** Chave anonima publica do projeto Supabase. */
    anonKey: string
    /** Opcoes repassadas ao createClient do supabase-js. */
    options?: SupabaseClientOptions<any>
}

export function createSupabaseClient<
    Database = any,
    SchemaNameOrClientOptions extends
        | (string & keyof Omit<Database, '__InternalSupabase'>)
        | { PostgrestVersion: string } =
        'public' extends keyof Omit<Database, '__InternalSupabase'>
            ? 'public'
            : string & keyof Omit<Database, '__InternalSupabase'>,
>(config: SupabaseConfig): SupabaseClient<Database, SchemaNameOrClientOptions> {
    if (!config.url || !config.anonKey) {
        throw new SupabaseError(
            'INVALID_CONFIG',
            'Supabase URL e Anon Key sao obrigatorios'
        )
    }

    return createClient<Database, SchemaNameOrClientOptions>(
        config.url,
        config.anonKey,
        config.options
    )
}
