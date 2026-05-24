import { createAiApiError } from '../errors'
import { normalizeBaseUrl } from './generateText'

export type OllamaModelInfo = {
    id: string
    name: string
    size?: number
    modifiedAt?: string
}

type OllamaTagsResponse = {
    models?: Array<{
        name?: string
        model?: string
        size?: number
        modified_at?: string
    }>
}

export async function listModels(baseUrl?: string): Promise<OllamaModelInfo[]> {
    let response: Response

    try {
        response = await fetch(`${normalizeBaseUrl(baseUrl)}/api/tags`)
    } catch {
        throw createAiApiError('NETWORK_ERROR')
    }

    if (!response.ok) {
        const body = await response.text()
        throw createAiApiError(`HTTP_${response.status}`, response.status, body)
    }

    const data = (await response.json()) as OllamaTagsResponse
    return (data.models ?? [])
        .map((model) => {
            const id = model.name ?? model.model ?? ''
            return {
                id,
                name: id,
                size: model.size,
                modifiedAt: model.modified_at,
            }
        })
        .filter((model) => model.id.length > 0)
}
