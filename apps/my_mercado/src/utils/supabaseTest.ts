/**
 * Teste de Conexão com Supabase
 *
 * Verifica se a conexão com o Supabase está funcionando corretamente.
 * Útil para debug e diagnóstico de problemas de conexão.
 */

import { supabase } from '../services/supabaseClient';

export interface ConnectionStatus {
  configured: boolean;
  authenticated: boolean;
  databaseAccessible: boolean;
  userId: string | null;
  email: string | null;
  error?: string;
}

/**
 * Testa a conexão com o Supabase
 */
export async function testSupabaseConnection(): Promise<ConnectionStatus> {
  const result: ConnectionStatus = {
    configured: false,
    authenticated: false,
    databaseAccessible: false,
    userId: null,
    email: null,
  };

  // 1. Verificar se Supabase está configurado
  if (!supabase) {
    result.error = 'Supabase não configurado. Verifique as variáveis de ambiente.';
    return result;
  }

  result.configured = true;

  // 2. Verificar autenticação
  try {
    const { data: { session } } = await supabase.auth.getSession();

    if (session?.user) {
      result.authenticated = true;
      result.userId = session.user.id;
      result.email = session.user.email ?? null;
    }
  } catch (error) {
    result.error = `Erro de autenticação: ${error instanceof Error ? error.message : 'Desconhecido'}`;
    return result;
  }

  // 3. Verificar acesso ao banco de dados
  if (result.authenticated) {
    try {
      const { error } = await supabase
        .from('receipts')
        .select('id')
        .limit(1);

      if (error) {
        result.error = `Erro no banco de dados: ${error.message}`;
      } else {
        result.databaseAccessible = true;
      }
    } catch (error) {
      result.error = `Erro ao acessar banco: ${error instanceof Error ? error.message : 'Desconhecido'}`;
    }
  }

  return result;
}

/**
 * Verifica se o Supabase está configurado (síncrono)
 */
export function isSupabaseConfigured(): boolean {
  return supabase !== null;
}

/**
 * Verifica se o usuário está autenticado (assíncrono)
 */
export async function checkAuthentication(): Promise<{
  authenticated: boolean;
  userId: string | null;
  email: string | null;
}> {
  if (!supabase) {
    return { authenticated: false, userId: null, email: null };
  }

  const { data: { session } } = await supabase.auth.getSession();

  return {
    authenticated: !!session?.user,
    userId: session?.user?.id ?? null,
    email: session?.user?.email ?? null,
  };
}
