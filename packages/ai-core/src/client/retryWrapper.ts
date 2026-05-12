/**
 * Retry Wrapper
 *
 * Adds retry with simple backoff to a ProviderClient.
 */

import { AiApiError, isNetworkError, isRetryableError } from '../errors'
import type {
    GenerateTextOptions,
    GenerateTextResult,
    ProviderClient,
    TestConnectionResult,
} from './types'

export interface RetryOptions {
    maxRetries?: number
    delayMs?: number
}

const DEFAULT_MAX_RETRIES = 2
const DEFAULT_DELAY_MS = 1000

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

                    if (!shouldRetry(lastError)) {
                        break
                    }
                }
            }

            throw lastError ?? new Error('Retry failed: unknown error')
        },

        testConnection: async (): Promise<TestConnectionResult> => {
            return client.testConnection()
        },
    }
}

function shouldRetry(err: Error): boolean {
    if (err instanceof AiApiError) {
        if (err.isClientError()) return false
        return isRetryableError(err.code) || isNetworkError(err.code) || err.isServerError()
    }

    return false
}

async function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
}
