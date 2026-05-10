/**
 * Erro padronizado para operações com Supabase.
 * Substitui erros genéricos por objetos com código, mensagem e causa.
 */
export class SupabaseError extends Error {
    /**
     * @param code - Código do erro (ex: 'AUTH_INVALID_CREDENTIALS', 'NETWORK_ERROR')
     * @param message - Mensagem legível para o usuário
     * @param cause - Erro original (opcional)
     */
    constructor(
        public readonly code: string,
        message: string,
        public readonly cause?: unknown
    ) {
        super(message)
        this.name = 'SupabaseError'
    }
}

/**
 * Verifica se um erro é do tipo SupabaseError com código iniciado por 'AUTH_'.
 * Útil para diferenciar erros de autenticação de outros tipos de erro.
 */
export function isAuthError(error: unknown): boolean {
    return error instanceof SupabaseError && error.code.startsWith('AUTH_')
}

/**
 * Verifica se um erro é relacionado a falha de rede (fetch).
 */
export function isNetworkError(error: unknown): boolean {
    return error instanceof TypeError && error.message.includes('fetch')
}

/**
 * Mapeia um erro desconhecido para SupabaseError padronizado.
 * Se o erro já for SupabaseError, retorna ele próprio.
 *
 * @param error - Erro a ser mapeado
 * @param defaultMessage - Mensagem padrão caso o erro não tenha mensagem
 */
export function mapSupabaseError(
    error: unknown,
    defaultMessage?: string
): SupabaseError {
    if (error instanceof SupabaseError) return error

    const message =
        error instanceof Error ? error.message : defaultMessage ?? 'Erro desconhecido'

    if (isNetworkError(error)) {
        return new SupabaseError('NETWORK_ERROR', 'Falha de conexão com o servidor', error)
    }

    return new SupabaseError('UNKNOWN_ERROR', message, error)
}