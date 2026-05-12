/**
 * OpenAI Test Connection
 *
 * Testa se a API key e modelo são válidos.
 */

import { generateText } from './generateText'

export type TestConnectionResult = {
    success: boolean
    error?: string
}

export async function testConnection(
    apiKey: string,
    model: string
): Promise<TestConnectionResult> {
    try {
        await generateText('Responda apenas "ok"', apiKey, model, {
            temperature: 0,
            maxTokens: 10,
        })
        return { success: true }
    } catch (err) {
        if (err instanceof Error) {
            return { success: false, error: err.message }
        }
        return { success: false, error: 'Erro desconhecido' }
    }
}