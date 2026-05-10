/**
 * API Error Types — Gaveta de Bagunça
 *
 * Tipos canônicos para erros de APIs de IA.
 * Servem como "contrato" entre backend (Rust, Node, etc.) e frontend.
 */

/** Códigos de erro canônicos */
export type ApiErrorCode =
    | 'INVALID_API_KEY'
    | 'RATE_LIMIT_EXCEEDED'
    | 'NETWORK_ERROR'
    | 'SERVICE_UNAVAILABLE'
    | 'SERVER_ERROR'
    | 'TIMEOUT'
    | 'INVALID_RESPONSE'
    | 'UNKNOWN_ERROR'

/** Estrutura padronizada de erro retornada por APIs de IA */
export interface ApiErrorLike {
    code: ApiErrorCode
    message: string
    status_code?: number
}

/** Mapa de códigos para mensagens amigáveis em português */
export const friendlyMessages: Record<ApiErrorCode, string> = {
    INVALID_API_KEY:
        'A chave de API informada não é válida. Gere uma nova em https://aistudio.google.com/apikey',
    RATE_LIMIT_EXCEEDED:
        'Muitas requisições em pouco tempo. Aguarde alguns segundos e tente novamente.',
    TIMEOUT:
        'O servidor demorou muito para responder. Verifique sua conexão e tente novamente.',
    SERVICE_UNAVAILABLE:
        'O serviço de IA está temporariamente fora do ar. Tente novamente mais tarde.',
    SERVER_ERROR:
        'Ocorreu um erro interno no servidor de IA. Tente novamente em alguns minutos.',
    INVALID_RESPONSE:
        'A API retornou uma resposta inesperada. Pode ser um problema temporário.',
    NETWORK_ERROR:
        'Não foi possível conectar ao servidor. Verifique sua conexão de internet.',
    UNKNOWN_ERROR:
        'Ocorreu um erro inesperado. Tente novamente.',
}

/** Retorna a mensagem amigável para um código */
export function getFriendlyMessage(code: ApiErrorCode, fallback?: string): string {
    return friendlyMessages[code] ?? fallback ?? `Erro inesperado (${code})`
}

// ------ Helpers ------

const AUTH_ERRORS: ApiErrorCode[] = ['INVALID_API_KEY']
const RETRYABLE_ERRORS: ApiErrorCode[] = ['RATE_LIMIT_EXCEEDED', 'SERVER_ERROR', 'SERVICE_UNAVAILABLE']
const NETWORK_ERRORS: ApiErrorCode[] = ['NETWORK_ERROR', 'TIMEOUT']

export function isAuthError(code: ApiErrorCode | string): boolean {
    return (AUTH_ERRORS as readonly string[]).includes(code)
}

export function isRetryableError(code: ApiErrorCode | string): boolean {
    return (RETRYABLE_ERRORS as readonly string[]).includes(code)
}

export function isNetworkError(code: ApiErrorCode | string): boolean {
    return (NETWORK_ERRORS as readonly string[]).includes(code)
}