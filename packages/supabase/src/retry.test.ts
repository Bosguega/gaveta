import { describe, expect, it } from 'vitest'
import { SupabaseError } from './errors'
import { withRetry } from './retry'

describe('withRetry', () => {
    it('does not retry non-recoverable errors', async () => {
        let calls = 0

        await expect(
            withRetry(
                async () => {
                    calls += 1
                    throw { code: '23505', message: 'duplicate' }
                },
                { attempts: 3, baseDelayMs: 0 }
            )
        ).rejects.toMatchObject({ code: '23505' })

        expect(calls).toBe(1)
    })

    it('retries recoverable errors and wraps exhausted attempts', async () => {
        let calls = 0

        await expect(
            withRetry(
                async () => {
                    calls += 1
                    throw { status: 503, message: 'unavailable' }
                },
                { attempts: 2, baseDelayMs: 0 }
            )
        ).rejects.toMatchObject({
            code: 'RETRY_EXHAUSTED',
        })

        expect(calls).toBe(2)
    })

    it('honors a custom retry predicate', async () => {
        let calls = 0

        await expect(
            withRetry(
                async () => {
                    calls += 1
                    throw new Error('custom')
                },
                {
                    attempts: 2,
                    baseDelayMs: 0,
                    shouldRetry: () => true,
                }
            )
        ).rejects.toBeInstanceOf(SupabaseError)

        expect(calls).toBe(2)
    })
})
