import { SupabaseError } from './errors'

/**
 * Opções para controle de tentativas de retry.
 */
export interface RetryOptions {
    /** Número máximo de tentativas (default: 3) */
    attempts?: number
    /** Atraso base em ms entre tentativas (default: 1000) */
    baseDelayMs?: number
    /** Atraso máximo em ms entre tentativas (default: 10000) */
    maxDelayMs?: number
}

/**
 * Executa uma função assíncrona com retry com backoff exponencial.
 * Lança SupabaseError se todas as tentativas falharem.
 *
 * @example
 * const data = await withRetry(() => client.from('users').select('*'), {
 *   attempts: 3,
 *   baseDelayMs: 500
 * })
 */
export async function withRetry<T>(
    fn: () => Promise<T>,
    options?: RetryOptions
): Promise<T> {
    const { attempts = 3, baseDelayMs = 1000, maxDelayMs = 10000 } = options ?? {}
    let last: unknown

    for (let i = 1; i <= attempts; i++) {
        try {
            return await fn()
        } catch (err) {
            last = err
            if (i < attempts) {
                const delay = Math.min(baseDelayMs * 2 ** (i - 1), maxDelayMs)
                await new Promise(r => setTimeout(r, delay))
            }
        }
    }

    throw new SupabaseError(
        'RETRY_EXHAUSTED',
        `Operação falhou após ${attempts} tentativas`,
        last
    )
}