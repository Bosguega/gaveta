/**
 * Gemini Provider Client Factory
 *
 * Wrapper fino que implementa a interface ProviderClient
 * usando as funções internas do módulo gemini/.
 */

import type { ProviderClient, GenerateTextOptions, GenerateTextResult } from '../client/types'
import { generateText } from './generateText'
import { testConnection } from './testConnection'

export function createGeminiClient(apiKey: string, model: string): ProviderClient {
    return {
        generateText: async (opts: GenerateTextOptions): Promise<GenerateTextResult> => {
            const result = await generateText(opts.userPrompt, apiKey, model, {
                temperature: opts.temperature,
                maxOutputTokens: opts.maxTokens,
            })
            return { text: result.text, model, provider: 'gemini' }
        },
        testConnection: () => testConnection(apiKey, model),
    }
}