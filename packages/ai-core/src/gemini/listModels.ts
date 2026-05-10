import { parseGeminiError } from './parseError'
import { createAiApiError } from './errors'

export type ModelInfo = {
    id: string
    name: string
}

export async function listModels(apiKey: string): Promise<ModelInfo[]> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models`

    let response: Response

    try {
        response = await fetch(url, {
            headers: {
                'x-goog-api-key': apiKey
            }
        })
    } catch {
        throw createAiApiError('NETWORK_ERROR')
    }

    if (!response.ok) {
        const body = await response.text()
        throw parseGeminiError(response.status, body)
    }

    const data = await response.json()

    if (!Array.isArray(data?.models)) {
        return []
    }

    return data.models
        .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
        .map((m: any) => ({
            id: m.name.replace('models/', ''),
            name: m.displayName ?? m.name
        }))
}