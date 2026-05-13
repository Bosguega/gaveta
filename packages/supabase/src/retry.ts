import { SupabaseError, isRetryableError } from './errors'

export interface RetryOptions {
    /** Numero maximo de tentativas totais (default: 3). */
    attempts?: number
    /** Atraso base em ms entre tentativas (default: 1000). */
    baseDelayMs?: number
    /** Atraso maximo em ms entre tentativas (default: 10000). */
    maxDelayMs?: number
    /** Decide se um erro pode ser retentado. Default: rede, timeout, 429 e 5xx. */
    shouldRetry?: (error: unknown, attempt: number) => boolean
}

export async function withRetry<T>(
    fn: () => Promise<T>,
    options?: RetryOptions
): Promise<T> {
    const {
        attempts = 3,
        baseDelayMs = 1000,
        maxDelayMs = 10000,
        shouldRetry = isRetryableError,
    } = options ?? {}
    let last: unknown

    for (let i = 1; i <= attempts; i++) {
        try {
            return await fn()
        } catch (err) {
            last = err

            if (!shouldRetry(err, i)) {
                throw err
            }

            if (i >= attempts) {
                throw new SupabaseError(
                    'RETRY_EXHAUSTED',
                    `Operacao falhou apos ${attempts} tentativas`,
                    err
                )
            }

            const delay = Math.min(baseDelayMs * 2 ** (i - 1), maxDelayMs)
            await new Promise(r => setTimeout(r, delay))
        }
    }

    throw new SupabaseError(
        'RETRY_EXHAUSTED',
        `Operacao falhou apos ${attempts} tentativas`,
        last
    )
}
