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
                {
                    role: 'user' as const,
                    content: options.images?.length
                        ? [
                            { type: 'text' as const, text: options.userPrompt },
                            ...options.images.map((image) => ({
                                type: 'image_url' as const,
                                image_url: { url: `data:${image.mimeType};base64,${image.data}` },
                            })),
                        ]
                        : options.userPrompt,
                },
            ]

            const result = await llama.chat({
                model,
                messages,
                temperature: options.temperature,
                maxTokens: options.maxTokens,
                enableThinking: options.enableThinking,
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

/**
 * Lists model identifiers exposed by the configured llama-server.
 */
export async function listLlamaCppModels(baseUrl = DEFAULT_BASE_URL): Promise<string[]> {
    return createLlamaClient({ baseUrl }).listModels()
}

/**
 * Checks whether the configured llama-server is healthy.
 */
export async function testLlamaCppConnection(baseUrl = DEFAULT_BASE_URL): Promise<{ success: boolean; error?: string }> {
    try {
        const available = await createLlamaClient({ baseUrl }).health()
        return available
            ? { success: true }
            : { success: false, error: 'O llama-server não está pronto para receber requisições.' }
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Não foi possível conectar ao llama-server.',
        }
    }
}
