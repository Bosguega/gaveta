import type { SupabaseClient, User, Session } from '@supabase/supabase-js'
import { SupabaseError } from './errors'

/**
 * Mapeia erros de autenticação do Supabase para SupabaseError padronizado.
 * Cada tipo de erro recebe um código específico e mensagem em português.
 *
 * @param error - Erro retornado pelo Supabase auth
 * @param context - Nome da operação que gerou o erro (ex: 'signIn')
 */
export function mapAuthError(error: unknown, context: string): SupabaseError {
    const msg = error instanceof Error ? error.message.toLowerCase() : ''

    if (msg.includes('invalid login credentials') || msg.includes('invalid_credentials')) {
        return new SupabaseError('AUTH_INVALID_CREDENTIALS', 'Email ou senha incorretos', error)
    }
    if (msg.includes('email not confirmed') || msg.includes('email_not_confirmed')) {
        return new SupabaseError('AUTH_EMAIL_NOT_CONFIRMED', 'Email não confirmado. Verifique sua caixa de entrada.', error)
    }
    if (msg.includes('user already registered') || msg.includes('already_registered')) {
        return new SupabaseError('AUTH_USER_EXISTS', 'Este email já está cadastrado.', error)
    }
    if (msg.includes('weak_password') || msg.includes('password should be at least')) {
        return new SupabaseError('AUTH_WEAK_PASSWORD', 'A senha deve ter pelo menos 6 caracteres.', error)
    }
    if (msg.includes('invalid email') || msg.includes('invalid_email')) {
        return new SupabaseError('AUTH_INVALID_EMAIL', 'Email inválido. Verifique o formato.', error)
    }

    return new SupabaseError('AUTH_UNKNOWN', `Falha de autenticação: ${context}`, error)
}

/**
 * Faz login com email e senha.
 * Lança SupabaseError em caso de falha.
 */
export async function signIn(client: SupabaseClient, email: string, password: string) {
    const { data, error } = await client.auth.signInWithPassword({ email, password })
    if (error) throw mapAuthError(error, 'signIn')
    return data
}

/**
 * Cadastra um novo usuário com email e senha.
 * Lança SupabaseError em caso de falha.
 */
export async function signUp(client: SupabaseClient, email: string, password: string) {
    const { data, error } = await client.auth.signUp({ email, password })
    if (error) throw mapAuthError(error, 'signUp')
    return data
}

/**
 * Encerra a sessão do usuário.
 * Lança SupabaseError em caso de falha.
 */
export async function signOut(client: SupabaseClient) {
    const { error } = await client.auth.signOut()
    if (error) throw new SupabaseError('AUTH_SIGNOUT_FAILED', 'Erro ao encerrar sessão', error)
}

/**
 * Retorna o usuário autenticado ou null se não estiver logado.
 * Não lança erro — apenas retorna null.
 */
export async function getUser(client: SupabaseClient): Promise<User | null> {
    const { data, error } = await client.auth.getUser()
    if (error) return null
    return data.user
}

export async function requireUser(client: SupabaseClient): Promise<User> {
    const { data, error } = await client.auth.getUser()
    if (error) throw mapAuthError(error, 'requireUser')
    if (!data.user) {
        throw new SupabaseError('AUTH_SESSION_MISSING', 'Usuario nao autenticado')
    }
    return data.user
}

export async function getAuthenticatedContext(client: SupabaseClient): Promise<{
    client: SupabaseClient
    user: User
}> {
    const user = await requireUser(client)
    return { client, user }
}

/**
 * Obtém a sessão atual ou null se não houver sessão ativa.
 * Não lança erro — apenas retorna null.
 */
export async function getSession(client: SupabaseClient): Promise<Session | null> {
    const { data, error } = await client.auth.getSession()
    if (error) return null
    return data.session
}

export async function requireSession(client: SupabaseClient): Promise<Session> {
    const { data, error } = await client.auth.getSession()
    if (error) throw mapAuthError(error, 'requireSession')
    if (!data.session) {
        throw new SupabaseError('AUTH_SESSION_MISSING', 'Sessao nao encontrada')
    }
    return data.session
}

/**
 * Escuta mudanças no estado de autenticação.
 * Retorna um objeto subscription com .unsubscribe() para cancelar.
 *
 * @example
 * const sub = onAuthStateChange(client, (event, session) => {
 *   if (event === 'SIGNED_IN') console.log('Usuário logou')
 * })
 * // Para parar de escutar:
 * sub.unsubscribe()
 */
export function onAuthStateChange(
    client: SupabaseClient,
    callback: (event: string, session: Session | null) => void
) {
    const { data } = client.auth.onAuthStateChange(callback)
    return data.subscription
}
