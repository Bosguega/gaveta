import { generateText } from './generateText'

export type TestConnectionResult = {
    success: boolean
    error?: string
}

export async function testConnection(
    model: string,
    baseUrl?: string
): Promise<TestConnectionResult> {
    try {
        await generateText('Responda apenas "ok"', model, {
            baseUrl,
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
