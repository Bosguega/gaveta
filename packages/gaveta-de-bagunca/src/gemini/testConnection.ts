import { generateText } from './generateText'
import { AiApiError } from './errors'

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
            maxOutputTokens: 10
        })
        return { success: true }
    } catch (err) {
        if (err instanceof AiApiError) {
            return { success: false, error: err.message }
        }
        if (err instanceof Error) {
            return { success: false, error: err.message }
        }
        return { success: false, error: 'Erro desconhecido' }
    }
}