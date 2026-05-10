import { createAiApiError, AiApiError } from './errors'

export type ParsedError = {
    message: string
    code: string
}

/**
 * Analisa o erro retornado pela API Gemini e retorna um AiApiError
 * com mensagem amigável em português.
 */
export function parseGeminiError(status: number, body: string): AiApiError {
    // Tenta extrair mensagem do corpo da resposta
    let apiMessage: string | undefined
    let apiCode: number | undefined

    try {
        const parsed = JSON.parse(body)
        const error = parsed?.error

        if (error) {
            apiMessage = error.message
            apiCode = error.code

            // Auth errors detectados pelo código ou conteúdo da mensagem
            if (apiCode === 403 || apiMessage?.includes('API_KEY')) {
                return createAiApiError('INVALID_API_KEY', status, apiMessage)
            }
        }
    } catch {
        // Corpo não é JSON — segue para tratamento por status
    }

    // Erros HTTP conhecidos
    switch (status) {
        case 403:
            return createAiApiError('INVALID_API_KEY', status, apiMessage)
        case 429:
            return createAiApiError('RATE_LIMIT_EXCEEDED', status, apiMessage)
        case 503:
            return createAiApiError('SERVICE_UNAVAILABLE', status, apiMessage)
        case 0:
        case 504:
            return createAiApiError('TIMEOUT', status, apiMessage)
        default:
            if (status >= 500) {
                return createAiApiError('SERVER_ERROR', status, apiMessage)
            }
            // Se tiver mensagem da API, usa ela como detalhe
            if (apiMessage) {
                return createAiApiError(`HTTP_${status}`, status, apiMessage)
            }
            return createAiApiError(`HTTP_${status}`, status)
    }
}