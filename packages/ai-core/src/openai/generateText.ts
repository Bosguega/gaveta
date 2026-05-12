/**
 * OpenAI Generate Text
 *
 * Chama a API OpenAI para gerar texto.
 * Sem lógica de domínio — apenas chamada HTTP e parsing básico.
 */

import { createAiApiError } from '../errors'

interface OpenAIResponse {
    choices?: Array<{
        message?: {
            content?: string
        }
    }>
}

export async function generateText(
    prompt: string,
    apiKey: string,
    model: string,
    options?: { temperature?: number; maxTokens?: number }
): Promise<{ text: string }> {
    let response: Response

    try {
        response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model,
                temperature: options?.temperature ?? 0.7,
                max_tokens: options?.maxTokens ?? 2048,
                messages: [
                    {
                        role: 'user',
                        content: prompt,
                    },
                ],
            }),
        })
    } catch {
        throw createAiApiError('NETWORK_ERROR')
    }

    if (!response.ok) {
        const body = await response.text()
        throw parseOpenAiError(response.status, body)
    }

    const data = (await response.json()) as OpenAIResponse
    const text = data?.choices?.[0]?.message?.content

    if (typeof text !== 'string') {
        throw createAiApiError('INVALID_RESPONSE_FORMAT')
    }

    return { text }
}

function parseOpenAiError(status: number, body: string): Error {
    // Tenta extrair mensagem do body JSON
    try {
        const parsed = JSON.parse(body)
        if (parsed?.error?.message) {
            return createAiApiError(
                mapOpenAiStatusToCode(status, parsed.error.code),
                status,
                parsed.error.message
            )
        }
    } catch {
        // fallthrough — usa status code genérico
    }

    return createAiApiError(`HTTP_${status}`, status, body)
}

function mapOpenAiStatusToCode(status: number, code?: string): string {
    if (status === 401) return 'INVALID_API_KEY'
    if (status === 429) return 'RATE_LIMIT_EXCEEDED'
    if (status === 500 || status === 503) return 'SERVICE_UNAVAILABLE'
    if (status >= 400 && status < 500) return 'SERVER_ERROR'
    return 'UNKNOWN_ERROR'
}
