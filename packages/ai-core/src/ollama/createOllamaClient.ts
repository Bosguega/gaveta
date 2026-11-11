import type { ProviderClient, GenerateTextOptions, GenerateTextResult } from '../client/types'
import { generateText } from './generateText'
import { testConnection } from './testConnection'

export function createOllamaClient(model: string, baseUrl?: string): ProviderClient {
    return {
        generateText: async (opts: GenerateTextOptions): Promise<GenerateTextResult> => {
            if (opts.images?.length) {
                throw new Error('O provedor Ollama ainda não oferece suporte a imagens pelo contrato ai-core.');
            }
            const result = await generateText(opts.userPrompt, model, {
                baseUrl,
                systemPrompt: opts.systemPrompt,
                temperature: opts.temperature,
                maxTokens: opts.maxTokens,
            })
            return { text: result.text, model, provider: 'ollama' }
        },
        testConnection: () => testConnection(model, baseUrl),
    }
}
