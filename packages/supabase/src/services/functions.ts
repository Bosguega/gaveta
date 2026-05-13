import type { FunctionInvokeOptions, SupabaseClient } from '@supabase/supabase-js'
import { SupabaseError } from '../errors'
import { withRetry } from '../retry'
import { withTimeout } from '../timeout'

export interface InvokeOptions extends Omit<FunctionInvokeOptions, 'timeout'> {
    /** Timeout em ms (default: 30000). */
    timeoutMs?: number
    /** Numero de tentativas totais (default: 1, sem retry). */
    retries?: number
    /** Permite data null/undefined como resposta valida. */
    allowEmptyResponse?: boolean
}

export async function invoke<T = unknown>(
    client: SupabaseClient,
    functionName: string,
    options?: InvokeOptions
): Promise<T> {
    const {
        timeoutMs = 30_000,
        retries = 1,
        allowEmptyResponse = false,
        ...invokeOptions
    } = options ?? {}

    const fn = () =>
        withTimeout(
            client.functions.invoke<T>(functionName, invokeOptions),
            timeoutMs
        )

    const response = await withRetry(fn, { attempts: retries })

    if (response.error) {
        throw new SupabaseError(
            'EDGE_FUNCTION_ERROR',
            response.error.message,
            response.error
        )
    }

    if (!allowEmptyResponse && (response.data === null || response.data === undefined)) {
        throw new SupabaseError(
            'EDGE_FUNCTION_EMPTY_RESPONSE',
            `Edge function '${functionName}' retornou resposta vazia`
        )
    }

    return response.data as T
}
