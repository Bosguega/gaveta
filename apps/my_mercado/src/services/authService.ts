import { supabase } from "./supabaseClient";
import { logger } from "../utils/logger";
import { ErrorCodes, AppError } from "../utils/errorCodes";

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
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  });
  if (error) {
    const errorMessage = error.message?.toLowerCase() || '';
    const errorStatus = (error as { status?: number })?.status;

    // Erro 400 = credenciais inválidas ou usuário não existe
    if (errorStatus === 400) {
      logger.error("authService", "Invalid credentials", error, ErrorCodes.AUTH_INVALID_CREDENTIALS);
      throw new AppError(
        ErrorCodes.AUTH_INVALID_CREDENTIALS,
        "Email ou senha incorretos. Verifique suas credenciais.",
        "login",
        { status: errorStatus, email }
      );
    }

    if (errorMessage.includes('invalid login credentials') || errorMessage.includes('invalid_credentials')) {
      logger.error("authService", "Invalid credentials", error, ErrorCodes.AUTH_INVALID_CREDENTIALS);
      throw new AppError(
        ErrorCodes.AUTH_INVALID_CREDENTIALS,
        "Email ou senha incorretos. Verifique suas credenciais.",
        "login",
        { email }
      );
    }
    if (errorMessage.includes('email not confirmed') || errorMessage.includes('email_not_confirmed')) {
      logger.error("authService", "Email not confirmed", error, ErrorCodes.AUTH_EMAIL_NOT_CONFIRMED);
      throw new AppError(
        ErrorCodes.AUTH_EMAIL_NOT_CONFIRMED,
        "Email não confirmado. Verifique sua caixa de entrada.",
        "login",
        { email }
      );
    }
    if (errorMessage.includes('user not found') || errorMessage.includes('not found')) {
      logger.error("authService", "User not found", error, ErrorCodes.NOT_FOUND);
      throw new AppError(
        ErrorCodes.NOT_FOUND,
        "Usuário não encontrado. Verifique o email ou crie uma conta.",
        "login",
        { email }
      );
    }
    if (errorMessage.includes('invalid email') || errorMessage.includes('invalid_email')) {
      logger.error("authService", "Invalid email", error, ErrorCodes.AUTH_INVALID_EMAIL);
      throw new AppError(
        ErrorCodes.AUTH_INVALID_EMAIL,
        "Email inválido. Verifique o formato.",
        "login",
        { email }
      );
    }

    // Erro genérico
    logger.error("authService", "Login failed", error, ErrorCodes.AUTH_LOGIN_FAILED);
    throw error;
  }
  return data;
}

/**
 * Realiza cadastro com email e senha
 */
export async function register(email: string, password: string) {
  const client = requireSupabase();
  const { data, error } = await client.auth.signUp({
    email,
    password,
  });
  if (error) {
    const errorMessage = error.message?.toLowerCase() || '';

    if (errorMessage.includes('user already registered') || errorMessage.includes('already_registered')) {
      logger.error("authService", "User already registered", error, ErrorCodes.AUTH_REGISTER_FAILED);
      throw new AppError(
        ErrorCodes.AUTH_REGISTER_FAILED,
        "Este email já está cadastrado. Faça login ou use outro email.",
        "register",
        { email }
      );
    }
    if (errorMessage.includes('password should be at least') || errorMessage.includes('weak_password')) {
      logger.error("authService", "Weak password", error, ErrorCodes.AUTH_WEAK_PASSWORD);
      throw new AppError(
        ErrorCodes.AUTH_WEAK_PASSWORD,
        "A senha deve ter pelo menos 6 caracteres.",
        "register"
      );
    }
    if (errorMessage.includes('invalid email') || errorMessage.includes('invalid_email')) {
      logger.error("authService", "Invalid email", error, ErrorCodes.AUTH_INVALID_EMAIL);
      throw new AppError(
        ErrorCodes.AUTH_INVALID_EMAIL,
        "Email inválido. Verifique o formato.",
        "register",
        { email }
      );
    }

    // Erro genérico
    logger.error("authService", "Register failed", error, ErrorCodes.AUTH_REGISTER_FAILED);
    throw error;
  }
  return data;
}

/**
 * Realiza logout do usuário
 */
export async function logout() {
  const client = requireSupabase();
  const { error } = await client.auth.signOut();
  if (error) {
    logger.error("authService", "Logout failed", error, ErrorCodes.AUTH_LOGOUT_FAILED);
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
  const { data, error } = await client.auth.getUser();
  if (error || !data?.user) {
    logger.error("authService", "User not authenticated", error, ErrorCodes.AUTH_SESSION_INVALID);
    throw new AppError(
      ErrorCodes.AUTH_SESSION_INVALID,
      "Usuário não autenticado",
      "getUserOrThrow"
    );
  }
  return data.user;
}

/**
 * Retorna o client Supabase e o usuario autenticado em uma unica chamada.
 */
export async function getAuthenticatedSupabaseContext() {
  const client = requireSupabase();
  const { data, error } = await client.auth.getUser();
  if (error || !data?.user) {
    logger.error("authService", "User not authenticated", error, ErrorCodes.AUTH_SESSION_INVALID);
    throw new AppError(
      ErrorCodes.AUTH_SESSION_INVALID,
      "UsuÃ¡rio nÃ£o autenticado",
      "getAuthenticatedSupabaseContext"
    );
  }

  return {
    client,
    user: data.user,
  };
}

/**
 * Verifica se o usuário está autenticado
 */
export async function isAuthenticated(): Promise<boolean> {
  try {
    const client = requireSupabase();
    const { data } = await client.auth.getUser();
    return !!data?.user;
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
    const { data } = await client.auth.getUser();
    return data?.user ?? null;
  } catch {
    return null;
  }
}
