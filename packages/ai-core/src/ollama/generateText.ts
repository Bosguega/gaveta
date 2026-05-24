import { createAiApiError } from '../errors'

export const DEFAULT_OLLAMA_BASE_URL = 'http://localhost:11434'

export type GenerateTextOptions = {
    systemPrompt?: string
    temperature?: number
    maxTokens?: number
}

export type GenerateTextResult = {
    text: string
}

type OllamaGenerateResponse = {
    response?: string
}

export async function generateText(
    prompt: string,
    model: string,
    options?: GenerateTextOptions & { baseUrl?: string }
): Promise<GenerateTextResult> {
    const baseUrl = normalizeBaseUrl(options?.baseUrl)
    let response: Response

    try {
        response = await fetch(`${baseUrl}/api/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model,
                prompt,
                system: options?.systemPrompt,
                stream: false,
                options: {
                    temperature: options?.temperature ?? 0.7,
                    num_predict: options?.maxTokens ?? 2048,
                },
            }),
        })
    } catch {
        throw createAiApiError('NETWORK_ERROR')
    }

    if (!response.ok) {
        const body = await response.text()
        throw createAiApiError(`HTTP_${response.status}`, response.status, body)
    }

    const data = (await response.json()) as OllamaGenerateResponse
    const text = data.response

    if (typeof text !== 'string') {
        throw createAiApiError('INVALID_RESPONSE_FORMAT')
    }

    return { text }
}

export function normalizeBaseUrl(baseUrl?: string): string {
    return (baseUrl?.trim() || DEFAULT_OLLAMA_BASE_URL).replace(/\/+$/, '')
}
