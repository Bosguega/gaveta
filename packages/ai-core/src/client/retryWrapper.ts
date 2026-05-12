/**
 * Retry Wrapper
 *
 * Wrapper que adiciona retry com backoff exponencial a um ProviderClient.
 * Responsabilidade única: retentar chamadas de rede com falha recuperável.
 */

import type { ProviderClient, GenerateTextOptions, GenerateTextResult, TestConnectionResult } from './types'

export interface RetryOptions {
    maxRetries?: number
    delayMs?: number
}

const DEFAULT_MAX_RETRIES = 2
const DEFAULT_DELAY_MS = 1000

/**
 * Envolve um ProviderClient com lógica de retry.
 *
 * Regras:
 * - Não retenta erros de autenticação (4xx exceto 429)
 * - Backoff exponencial simples
 * - testConnection NÃO tem retry
 */
export function withRetry(
    client: ProviderClient,
    options?: RetryOptions
): ProviderClient {
    const maxRetries = options?.maxRetries ?? DEFAULT_MAX_RETRIES
    const delayMs = options?.delayMs ?? DEFAULT_DELAY_MS

    return {
        generateText: async (opts: GenerateTextOptions): Promise<GenerateTextResult> => {
            let lastError: Error | null = null

            for (let attempt = 0; attempt <= maxRetries; attempt++) {
                try {
                    if (attempt > 0) {
                        await delay(delayMs * attempt)
                    }
                    return await client.generateText(opts)
                } catch (err) {
                    lastError = err instanceof Error ? err : new Error(String(err))

                    // Não retenta se for erro do cliente (exceto rate limit)
                    if (isClientError(lastError) && !isRateLimitError(lastError)) {
                        break
                    }
                }
            }

            throw lastError ?? new Error('Retry failed: unknown error')
        },

        testConnection: async (): Promise<TestConnectionResult> => {
            // testConnection executa uma única vez, sem retry
            return client.testConnection()
        },
    }
}

function isClientError(err: Error): boolean {
    // Detecta erros HTTP 4xx pela mensagem
    return /HTTP_4\d{2}/.test(err.message) ||
        /INVALID_API_KEY/.test(err.message)
}

function isRateLimitError(err: Error): boolean {
    return /RATE_LIMIT_EXCEEDED/.test(err.message) ||
        /HTTP_429/.test(err.message)
}

async function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
}