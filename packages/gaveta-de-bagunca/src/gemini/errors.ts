/**
 * AiApiError — Erro tipado para falhas nas APIs de IA.
 *
 * Permite identificar o tipo de erro sem depender de comparação de strings.
 * Leva uma mensagem amigável para exibir ao usuário final.
 */
export class AiApiError extends Error {
    readonly code: string
    readonly statusCode?: number

    constructor(message: string, code: string, statusCode?: number) {
        super(message)
        this.name = 'AiApiError'
        this.code = code
        this.statusCode = statusCode
    }

    /** Erro de autenticação (API key inválida/sem permissão) */
    isAuthError(): boolean {
        return this.code === 'INVALID_API_KEY'
    }

    /** Erro de rate limit (429) */
    isRateLimit(): boolean {
        return this.code === 'RATE_LIMIT_EXCEEDED'
    }

    /** Erro de cliente (4xx) que NÃO deve disparar retry */
    isClientError(): boolean {
        if (!this.statusCode) return false
        return this.statusCode >= 400 && this.statusCode < 500 && this.statusCode !== 429
    }

    /** Erro de servidor (5xx) — pode tentar retry */
    isServerError(): boolean {
        if (!this.statusCode) return false
        return this.statusCode >= 500
    }

    /** Erro de rede/timeout */
    isNetworkError(): boolean {
        return this.code === 'TIMEOUT' || this.code === 'NETWORK_ERROR'
    }
}

/**
 * Mapa de códigos de erro para mensagens amigáveis em português.
 */
export const friendlyMessages: Record<string, string> = {
    INVALID_API_KEY:
        'A chave de API informada não é válida. Gere uma nova em https://aistudio.google.com/apikey',
    RATE_LIMIT_EXCEEDED:
        'Muitas requisições em pouco tempo. Aguarde alguns segundos e tente novamente.',
    TIMEOUT:
        'O servidor demorou muito para responder. Verifique sua conexão e tente novamente.',
    SERVICE_UNAVAILABLE:
        'O serviço Gemini está temporariamente fora do ar. Tente novamente mais tarde.',
    SERVER_ERROR:
        'Ocorreu um erro interno no servidor Gemini. Tente novamente em alguns minutos.',
    INVALID_RESPONSE_FORMAT:
        'A API retornou uma resposta inesperada. Pode ser um problema temporário.',
    NETWORK_ERROR:
        'Não foi possível conectar ao servidor. Verifique sua conexão de internet.'
}

/**
 * Retorna a mensagem amigável para um código, ou fallback genérico.
 */
export function getFriendlyMessage(code: string, fallback?: string): string {
    return friendlyMessages[code] ?? fallback ?? `Erro inesperado (${code})`
}

/** Cria um AiApiError já com mensagem amigável */
export function createAiApiError(code: string, statusCode?: number, details?: string): AiApiError {
    const message = details
        ? `${getFriendlyMessage(code)}: ${details}`
        : getFriendlyMessage(code)
    return new AiApiError(message, code, statusCode)
}