import { parseGeminiError } from './parseError'
import { createAiApiError } from '../errors'

export type GenerateTextOptions = {
    temperature?: number
    maxOutputTokens?: number
}

export type GenerateTextResult = {
    text: string
}

export async function generateText(
    prompt: string,
    apiKey: string,
    model: string,
    options?: GenerateTextOptions
): Promise<GenerateTextResult> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`

    let response: Response

    try {
        response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': apiKey
            },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: options?.temperature ?? 0.7,
                    maxOutputTokens: options?.maxOutputTokens ?? 2048
                }
            })
        })
    } catch {
        // Erro de rede — fetch não conseguiu conectar
        throw createAiApiError('NETWORK_ERROR')
    }

    if (!response.ok) {
        const body = await response.text()
        throw parseGeminiError(response.status, body)
    }

    const data = await response.json()

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text

    if (typeof text !== 'string') {
        throw createAiApiError('INVALID_RESPONSE_FORMAT')
    }

    return { text }
}
