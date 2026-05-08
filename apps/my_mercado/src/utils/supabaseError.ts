import { AppError, ErrorCodes, type ErrorCode } from "./errorCodes";

type SupabaseLikeError = {
  code?: unknown;
  message?: unknown;
  details?: unknown;
};

export function mapSupabaseError(
  error: unknown,
  context: string,
  fallbackCode: ErrorCode = ErrorCodes.OPERATION_FAILED,
): AppError {
  if (error instanceof AppError) return error;

  const candidate = error as SupabaseLikeError | null;
  const code = typeof candidate?.code === "string" ? candidate.code : undefined;
  const message =
    typeof candidate?.message === "string"
      ? candidate.message
      : error instanceof Error
        ? error.message
        : "Erro ao executar operacao no Supabase";

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
