import type { ProviderClient, GenerateTextOptions, GenerateTextResult } from '../client/types'
import { generateText } from './generateText'
import { testConnection } from './testConnection'

export function createOllamaClient(model: string, baseUrl?: string): ProviderClient {
    return {
        generateText: async (opts: GenerateTextOptions): Promise<GenerateTextResult> => {
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
