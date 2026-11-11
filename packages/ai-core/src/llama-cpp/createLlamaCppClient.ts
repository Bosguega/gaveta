import { createLlamaClient, DEFAULT_BASE_URL } from '@bosguega/llama-cpp'
import type { ChatMessage } from '@bosguega/llama-cpp'
import type { ProviderClient, GenerateTextOptions, GenerateTextResult } from '../client/types'

/**
 * Creates an ai-core provider adapter backed by a running llama-server.
 * The HTTP protocol and server-specific behavior remain in @bosguega/llama-cpp.
 */
export function createLlamaCppClient(model: string, baseUrl = DEFAULT_BASE_URL): ProviderClient {
    const llama = createLlamaClient({ baseUrl, defaultModel: model })

    return {
        generateText: async (options: GenerateTextOptions): Promise<GenerateTextResult> => {
            const messages: ChatMessage[] = [
                ...(options.systemPrompt ? [{ role: 'system' as const, content: options.systemPrompt }] : []),
                { role: 'user' as const, content: options.userPrompt },
            ]

            const result = await llama.chat({
                model,
                messages,
                temperature: options.temperature,
                maxTokens: options.maxTokens,
            })

            return {
                text: result.content,
                model,
                provider: 'llama-cpp',
            }
        },
        testConnection: async () => {
            try {
                const available = await llama.health()
                return available
                    ? { success: true }
                    : { success: false, error: 'O llama-server não está pronto para receber requisições.' }
            } catch (error) {
                return {
                    success: false,
                    error: error instanceof Error ? error.message : 'Não foi possível conectar ao llama-server.',
                }
            }
        },
    }
}
