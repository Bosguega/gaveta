import type { SupabaseClient } from '@supabase/supabase-js'
import { SupabaseError } from '../errors'
import { withTimeout } from '../timeout'
import { withRetry } from '../retry'

/**
 * Opções para invocação de edge function.
 */
export interface InvokeOptions {
    /** Payload enviado à função */
    body?: Record<string, unknown>
    /** Timeout em ms (default: 30000) */
    timeoutMs?: number
    /** Número de tentativas em caso de falha (default: 1, sem retry) */
    retries?: number
}

/**
 * Executa uma edge function do Supabase com suporte a timeout e retry.
 * Retorna apenas o payload de sucesso (unwrap automático de { data, error }).
 * Lança SupabaseError em caso de erro na função, timeout ou falha de rede.
 *
 * @example
 * const result = await invoke(client, 'send-email', {
 *   body: { to: 'user@email.com' },
 *   timeoutMs: 10000,
 *   retries: 2
 * })
 */
export async function invoke<T = unknown>(
    client: SupabaseClient,
    functionName: string,
    options?: InvokeOptions
): Promise<T> {
    const fn = () =>
        withTimeout(
            client.functions.invoke<T>(functionName, { body: options?.body }),
            options?.timeoutMs ?? 30_000
        )

    const response = await withRetry(fn, { attempts: options?.retries ?? 1 })

    if (response.error) {
        throw new SupabaseError(
            'EDGE_FUNCTION_ERROR',
            response.error.message,
            response.error
        )
    }

    // response.data é T | null; se for null tratamos como erro
    if (response.data === null || response.data === undefined) {
        throw new SupabaseError(
            'EDGE_FUNCTION_EMPTY_RESPONSE',
            `Edge function '${functionName}' retornou resposta vazia`
        )
    }

    return response.data as T
}
