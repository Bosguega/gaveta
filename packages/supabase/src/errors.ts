export class SupabaseError extends Error {
    constructor(
        public readonly code: string,
        message: string,
        public readonly cause?: unknown,
        public readonly statusCode?: number
    ) {
        super(message)
        this.name = 'SupabaseError'
    }
}

export interface SupabaseErrorInfo {
    code?: string
    message: string
    details?: string
    hint?: string
    status?: number
}

type ErrorRecord = {
    code?: unknown
    message?: unknown
    details?: unknown
    hint?: unknown
    status?: unknown
    statusCode?: unknown
    context?: unknown
    name?: string
}

export function isAuthError(error: unknown): boolean {
    return error instanceof SupabaseError && error.code.startsWith('AUTH_')
}

export function isNetworkError(error: unknown): boolean {
    if (error instanceof SupabaseError) {
        return error.code === 'NETWORK_ERROR'
    }

    if (isErrorRecord(error) && error.name === 'FunctionsFetchError') {
        return true
    }

    return error instanceof TypeError && error.message.toLowerCase().includes('fetch')
}

export function getSupabaseErrorInfo(
    error: unknown,
    fallbackMessage = 'Erro desconhecido'
): SupabaseErrorInfo {
    if (error instanceof SupabaseError) {
        const causeInfo = error.cause ? getSupabaseErrorInfo(error.cause, error.message) : undefined
        return {
            code: error.code,
            message: error.message,
            details: causeInfo?.details,
            hint: causeInfo?.hint,
            status: error.statusCode ?? causeInfo?.status,
        }
    }

    if (!isErrorRecord(error)) {
        return {
            message: error instanceof Error ? error.message : fallbackMessage,
        }
    }

    const context = isErrorRecord(error.context) ? error.context : undefined
    const status = toNumber(error.status) ?? toNumber(error.statusCode) ?? toNumber(context?.status)
    const message =
        toString(error.message) ??
        toString(context?.message) ??
        fallbackMessage

    return {
        code: toString(error.code) ?? error.name,
        message,
        details: toString(error.details) ?? toString(context?.details),
        hint: toString(error.hint) ?? toString(context?.hint),
        status,
    }
}

export function isRetryableError(error: unknown): boolean {
    if (isNetworkError(error)) return true

    const info = getSupabaseErrorInfo(error)
    if (info.code === 'TIMEOUT' || info.code === 'NETWORK_ERROR') return true
    if (info.code === 'FunctionsRelayError' || info.code === 'FunctionsFetchError') return true
    if (info.status === 408 || info.status === 429) return true
    if (typeof info.status === 'number' && info.status >= 500) return true

    return false
}

export function mapSupabaseError(
    error: unknown,
    defaultMessage?: string
): SupabaseError {
    if (error instanceof SupabaseError) return error

    const info = getSupabaseErrorInfo(error, defaultMessage ?? 'Erro desconhecido')

    if (isNetworkError(error)) {
        return new SupabaseError('NETWORK_ERROR', 'Falha de conexao com o servidor', error)
    }

    return new SupabaseError(info.code ?? 'UNKNOWN_ERROR', info.message, error, info.status)
}

function isErrorRecord(value: unknown): value is ErrorRecord {
    return !!value && typeof value === 'object'
}

function toString(value: unknown): string | undefined {
    return typeof value === 'string' && value.length > 0 ? value : undefined
}

function toNumber(value: unknown): number | undefined {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}
