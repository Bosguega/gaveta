import { afterEach, describe, expect, it, vi } from 'vitest'
import { createLlamaCppClient, listLlamaCppModels } from './createLlamaCppClient'

const originalFetch = globalThis.fetch

afterEach(() => {
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
})

describe('createLlamaCppClient', () => {
    it('adapts text generation to the ai-core provider contract', async () => {
        const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
            choices: [{ message: { content: 'Resposta local' }, finish_reason: 'stop' }],
        }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
        globalThis.fetch = fetchMock

        const client = createLlamaCppClient('bonsai', 'http://127.0.0.1:8080')
        const result = await client.generateText({
            systemPrompt: 'Seja objetivo.',
            userPrompt: 'Olá',
            temperature: 0.2,
            maxTokens: 100,
        })

        expect(result).toEqual({
            text: 'Resposta local',
            model: 'bonsai',
            provider: 'llama-cpp',
        })
        expect(fetchMock).toHaveBeenCalledWith(
            'http://127.0.0.1:8080/v1/chat/completions',
            expect.objectContaining({
                method: 'POST',
                body: expect.stringContaining('"role":"system"'),
            }),
        )
    })

    it('lists model identifiers from the llama-server', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
            data: [{ id: 'bonsai' }, { id: 'bge-m3' }],
        }), { status: 200, headers: { 'Content-Type': 'application/json' } }))

        await expect(listLlamaCppModels('http://127.0.0.1:8080')).resolves.toEqual(['bonsai', 'bge-m3'])
    })

    it('reports a healthy llama-server', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue(new Response('', { status: 200 }))
        const client = createLlamaCppClient('bonsai')

        await expect(client.testConnection()).resolves.toEqual({ success: true })
    })

    it('reports an unavailable llama-server without throwing', async () => {
        globalThis.fetch = vi.fn().mockRejectedValue(new Error('connection refused'))
        const client = createLlamaCppClient('bonsai')

        const result = await client.testConnection()
        expect(result.success).toBe(false)
        expect(result.error).toContain('connection refused')
    })
})
