import { describe, expect, it } from 'vitest'
import { createAiApiError } from '../errors'
import { withRetry } from './retryWrapper'
import type { ProviderClient } from './types'

function createFailingClient(error: Error, calls: { count: number }): ProviderClient {
    return {
        async generateText() {
            calls.count += 1
            throw error
        },
        async testConnection() {
            return { success: true }
        },
    }
}

describe('withRetry', () => {
    it('does not retry auth errors', async () => {
        const calls = { count: 0 }
        const client = withRetry(
            createFailingClient(createAiApiError('INVALID_API_KEY', 401), calls),
            { maxRetries: 2, delayMs: 0 }
        )

        await expect(client.generateText({ userPrompt: 'x' })).rejects.toMatchObject({
            code: 'INVALID_API_KEY',
        })
        expect(calls.count).toBe(1)
    })

    it('retries rate limit errors', async () => {
        const calls = { count: 0 }
        const client = withRetry(
            createFailingClient(createAiApiError('RATE_LIMIT_EXCEEDED', 429), calls),
            { maxRetries: 2, delayMs: 0 }
        )

        await expect(client.generateText({ userPrompt: 'x' })).rejects.toMatchObject({
            code: 'RATE_LIMIT_EXCEEDED',
        })
        expect(calls.count).toBe(3)
    })

    it('retries network errors', async () => {
        const calls = { count: 0 }
        const client = withRetry(
            createFailingClient(createAiApiError('NETWORK_ERROR'), calls),
            { maxRetries: 1, delayMs: 0 }
        )

        await expect(client.generateText({ userPrompt: 'x' })).rejects.toMatchObject({
            code: 'NETWORK_ERROR',
        })
        expect(calls.count).toBe(2)
    })
})
