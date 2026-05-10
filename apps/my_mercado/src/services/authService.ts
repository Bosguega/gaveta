import { signIn, signUp, signOut, getUser } from '@bosguega/supabase';
import { logger } from "../utils/logger";
import { ErrorCodes, AppError } from "../utils/errorCodes";
import { supabase } from "./supabaseClient";

/**
 * Verifica se o Supabase está configurado e retorna a instância
 */
export function requireSupabase() {
  if (!supabase) {
    throw new AppError(
      ErrorCodes.SUPABASE_NOT_CONFIGURED,
      "Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.",
      "requireSupabase"
    );
  }
  return supabase;
}

/**
 * Realiza login com email e senha
 */
export async function login(email: string, password: string) {
  const client = requireSupabase();
  try {
    return await signIn(client, email, password);
  } catch (err) {
    logger.error("authService", "Login failed", err, ErrorCodes.AUTH_LOGIN_FAILED);
    throw err;
  }
}

/**
 * Realiza cadastro com email e senha
 */
export async function register(email: string, password: string) {
  const client = requireSupabase();
  try {
    return await signUp(client, email, password);
  } catch (err) {
    logger.error("authService", "Register failed", err, ErrorCodes.AUTH_REGISTER_FAILED);
    throw err;
  }
}

/**
 * Realiza logout do usuário
 */
export async function logout() {
  const client = requireSupabase();
  try {
    await signOut(client);
  } catch (err) {
    logger.error("authService", "Logout failed", err, ErrorCodes.AUTH_LOGOUT_FAILED);
    throw new AppError(
      ErrorCodes.AUTH_LOGOUT_FAILED,
      "Erro ao encerrar sessão.",
      "logout"
    );
  }
}

/**
 * Obtém o usuário autenticado ou lança erro
 */
export async function getUserOrThrow() {
  const client = requireSupabase();
  const user = await getUser(client);
  if (!user) {
    logger.error("authService", "User not authenticated", null, ErrorCodes.AUTH_SESSION_INVALID);
    throw new AppError(
      ErrorCodes.AUTH_SESSION_INVALID,
      "Usuário não autenticado",
      "getUserOrThrow"
    );
  }
  return user;
}

/**
 * Retorna o client Supabase e o usuario autenticado em uma unica chamada.
 */
export async function getAuthenticatedSupabaseContext() {
  const client = requireSupabase();
  const user = await getUser(client);
  if (!user) {
    logger.error("authService", "User not authenticated", null, ErrorCodes.AUTH_SESSION_INVALID);
    throw new AppError(
      ErrorCodes.AUTH_SESSION_INVALID,
      "Usuário não autenticado",
      "getAuthenticatedSupabaseContext"
    );
  }

  return {
    client,
    user,
  };
}

/**
 * Verifica se o usuário está autenticado
 */
export async function isAuthenticated(): Promise<boolean> {
  try {
    const client = requireSupabase();
    const user = await getUser(client);
    return !!user;
  } catch {
    return false;
  }
}

/**
 * Obtém o usuário autenticado ou null
 */
export async function getUserOrNull() {
  try {
    const client = requireSupabase();
    return await getUser(client);
  } catch {
    return null;
  }
}