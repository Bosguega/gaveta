import { AppError, ErrorCodes, type ErrorCode } from "./errorCodes";
import { getSupabaseErrorInfo } from "@bosguega/supabase";

export function mapSupabaseError(
  error: unknown,
  context: string,
  fallbackCode: ErrorCode = ErrorCodes.OPERATION_FAILED,
): AppError {
  if (error instanceof AppError) return error;

  const info = getSupabaseErrorInfo(error, "Erro ao executar operacao no Supabase");
  const code = info.code;
  const message = info.message;

  if (code === "PGRST116") {
    return new AppError(ErrorCodes.NOT_FOUND, "Registro nao encontrado.", context, error);
  }

  if (code === "42501" || code === "PGRST301") {
    return new AppError(ErrorCodes.PERMISSION_DENIED, "Operacao nao permitida.", context, error);
  }

  if (code === "23505") {
    return new AppError(ErrorCodes.PRODUCT_ALREADY_EXISTS, "Registro duplicado.", context, error);
  }

  if (code === "23503") {
    return new AppError(ErrorCodes.VALIDATION_ERROR, "Referencia invalida.", context, error);
  }

  return new AppError(fallbackCode, message, context, error);
}
