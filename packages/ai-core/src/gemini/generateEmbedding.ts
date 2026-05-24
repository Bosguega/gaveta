import { createAiApiError } from '../errors'
import { parseGeminiError } from './parseError'

export type GenerateEmbeddingResult = {
    embedding: number[]
    model: string
}

type GeminiEmbeddingResponse = {
    embedding?: {
        values?: number[]
    }
    embeddings?: Array<{
        values?: number[]
    }>
}

export async function generateEmbedding(
    text: string,
    apiKey: string,
    model: string
): Promise<GenerateEmbeddingResult> {
    const normalized = text.trim()
    if (!normalized) {
        throw createAiApiError('INVALID_RESPONSE')
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:embedContent?key=${encodeURIComponent(apiKey)}`

    let response: Response

    try {
        response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: `models/${model}`,
                content: {
                    parts: [{ text: normalized }],
                },
            }),
        })
    } catch {
        throw createAiApiError('NETWORK_ERROR')
    }

    if (!response.ok) {
        const body = await response.text()
        throw parseGeminiError(response.status, body)
    }

    const data = (await response.json()) as GeminiEmbeddingResponse
    const embedding = data.embedding?.values ?? data.embeddings?.[0]?.values

    if (!Array.isArray(embedding) || embedding.length === 0) {
        throw createAiApiError('INVALID_RESPONSE_FORMAT')
    }

    return { embedding, model }
}
