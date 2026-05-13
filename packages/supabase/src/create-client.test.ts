import { describe, expect, it } from 'vitest'
import { createSupabaseClient } from './create-client'

describe('createSupabaseClient', () => {
    it('rejects missing config', () => {
        expect(() => createSupabaseClient({ url: '', anonKey: '' })).toThrow(
            'Supabase URL e Anon Key sao obrigatorios'
        )
    })

    it('creates a client with supabase-js options', () => {
        const client = createSupabaseClient({
            url: 'https://example.supabase.co',
            anonKey: 'anon-key',
            options: {
                global: {
                    headers: { 'x-test': '1' },
                },
            },
        })

        expect(client).toEqual(expect.objectContaining({
            auth: expect.any(Object),
            functions: expect.any(Object),
        }))
    })
})
