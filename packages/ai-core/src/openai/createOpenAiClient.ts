/**
 * OpenAI Provider Client Factory
 *
 * Wrapper fino que implementa a interface ProviderClient
 * usando as funções internas do módulo openai/.
 */

import type { ProviderClient, GenerateTextOptions, GenerateTextResult } from '../client/types'
import { generateText } from './generateText'
import { testConnection } from './testConnection'

export function createOpenAiClient(apiKey: string, model: string): ProviderClient {
    return {
        generateText: async (opts: GenerateTextOptions): Promise<GenerateTextResult> => {
            const result = await generateText(opts.userPrompt, apiKey, model, {
                temperature: opts.temperature,
                maxTokens: opts.maxTokens,
            })
            return { text: result.text, model, provider: 'openai' }
        },
        testConnection: () => testConnection(apiKey, model),
    }
}