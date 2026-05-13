import { describe, expect, it } from 'vitest'
import { invoke } from './functions'

describe('invoke', () => {
    it('unwraps successful edge function responses', async () => {
        const client = {
            functions: {
                invoke: async (_name: string, options: unknown) => ({
                    data: { ok: true, options },
                    error: null,
                }),
            },
        }

        await expect(
            invoke(client as never, 'test-fn', {
                body: { value: 1 },
                headers: { 'x-test': '1' },
            })
        ).resolves.toEqual({
            ok: true,
            options: {
                body: { value: 1 },
                headers: { 'x-test': '1' },
            },
        })
    })

    it('throws on empty responses by default', async () => {
        const client = {
            functions: {
                invoke: async () => ({ data: null, error: null }),
            },
        }

        await expect(invoke(client as never, 'empty-fn')).rejects.toMatchObject({
            code: 'EDGE_FUNCTION_EMPTY_RESPONSE',
        })
    })

    it('allows empty responses when configured', async () => {
        const client = {
            functions: {
                invoke: async () => ({ data: null, error: null }),
            },
        }

        await expect(
            invoke(client as never, 'empty-fn', { allowEmptyResponse: true })
        ).resolves.toBeNull()
    })
})
