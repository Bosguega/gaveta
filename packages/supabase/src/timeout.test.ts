import { describe, expect, it } from 'vitest'
import { withTimeout } from './timeout'

describe('withTimeout', () => {
    it('resolves before timeout', async () => {
        await expect(withTimeout(Promise.resolve('ok'), 100)).resolves.toBe('ok')
    })

    it('rejects on timeout', async () => {
        await expect(
            withTimeout(new Promise((resolve) => setTimeout(resolve, 50)), 1)
        ).rejects.toMatchObject({ code: 'TIMEOUT' })
    })

    it('preserves original rejection', async () => {
        await expect(withTimeout(Promise.reject(new Error('boom')), 100)).rejects.toThrow('boom')
    })
})
