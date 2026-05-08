import { useCallback } from "react";
import { logger } from "../utils/logger";
import { notify } from "../utils/notifications";
import { errorMessages, formatErrorMessage, type ErrorMessageKey } from "../utils/errorMessages";

interface UseErrorHandlerOptions {
    /** Contexto do erro para logging */
    context: string;
    /** Mensagem fallback se erro for desconhecido */
    fallbackMessage?: string;
    /** Se true, não mostra toast, apenas log */
    silent?: boolean;
    /** Duração customizada do toast */
    toastDuration?: number;
    /** Mapeamento de erros específicos para mensagens customizadas */
    errorMap?: Partial<Record<string, ErrorMessageKey>>;
}

/**
 * Hook para tratamento centralizado de erros
 *
 * @example
 * ```tsx
 * const { handleError, handleApiError } = useErrorHandler({ context: "ShoppingList" });
 *
 * try {
 *   await saveItem();
 * } catch (err) {
 *   handleError(err, { fallbackMessage: "Não foi possível salvar o item." });
 * }
 * ```
 */
export function useErrorHandler(options: UseErrorHandlerOptions) {
    const {
        context,
        fallbackMessage = errorMessages.UNKNOWN_ERROR,
        silent = false,
        toastDuration,
        errorMap = {},
    } = options;

    /**
     * Trata um erro genérico
     * @param error - Erro capturado
     * @param options - Opções adicionais
     */
    const handleError = useCallback(
        (
            error: unknown,
            options?: {
                /** Mensagem customizada */
                message?: string;
                /** Chave da mensagem padronizada */
                messageKey?: ErrorMessageKey;
                /** Parâmetros para formatar mensagem */
                params?: Record<string, string | number>;
                /** Se true, usa fallback ao invés de mostrar erro técnico */
                useFallback?: boolean;
            }
        ) => {
            const { message, messageKey, params, useFallback = true } = options || {};

            // Log do erro
            logger.error(context, error instanceof Error ? error.message : String(error), error);

            if (silent) return;

            // Determinar mensagem a mostrar
            let errorMessage: string;

            if (message) {
                // Mensagem customizada fornecida
                errorMessage = message;
            } else if (messageKey) {
                // Usar mensagem padronizada por chave
                errorMessage = formatErrorMessage(errorMessages[messageKey], params);
            } else if (useFallback) {
                // Usar fallback ao invés de erro técnico
                errorMessage = fallbackMessage;
            } else {
                // Mostrar erro técnico (apenas em desenvolvimento)
                errorMessage = error instanceof Error ? error.message : String(error);
            }

            // Mostrar notificação
            notify.error(errorMessage, toastDuration);
        },
        [context, fallbackMessage, silent, toastDuration]
    );

    /**
     * Trata especificamente erros de API
     * @param error - Erro da API
     */
    const handleApiError = useCallback(
        (error: unknown) => {
            // Verificar se é erro de conexão
            if (error instanceof TypeError && error.message.includes("fetch")) {
                handleError(error, {
                    messageKey: "CONNECTION_ERROR",
                    useFallback: true,
                });
                return;
            }

            // Verificar se é erro de autenticação
            if (error instanceof Error && error.message.includes("auth")) {
                handleError(error, {
                    messageKey: "AUTH_SESSION_INVALID",
                    useFallback: true,
                });
                return;
            }

            // Verificar se é erro de permissão
            if (error instanceof Error && error.message.includes("permission")) {
                handleError(error, {
                    messageKey: "PERMISSION_DENIED",
                    useFallback: true,
                });
                return;
            }

            // Erro genérico
            handleError(error, { useFallback: true });
        },
        [handleError]
    );

    /**
     * Trata erros de validação
     * @param errors - Array de mensagens de erro de validação
     */
    const handleValidationErrors = useCallback(
        (errors: string[]) => {
            logger.warn(context, `Erros de validação: ${errors.join(", ")}`);

            if (silent) return;

            // Mostrar primeiro erro ou mensagem genérica
            const message = errors.length > 0
                ? errors[0]
                : errorMessages.VALIDATION_ERROR;

            notify.warning(message);
        },
        [context, silent]
    );

    /**
     * Trata erro específico mapeado
     * @param error - Erro capturado
     * @param errorCode - Código do erro para mapeamento
     */
    const handleMappedError = useCallback(
        (error: unknown, errorCode: string) => {
            const messageKey = errorMap[errorCode];

            if (messageKey) {
                handleError(error, { messageKey });
            } else {
                handleError(error, { useFallback: true });
            }
        },
        [errorMap, handleError]
    );

    return {
        handleError,
        handleApiError,
        handleValidationErrors,
        handleMappedError,
    };
}

/**
 * Hook simplificado para tratamento rápido de erros
 * Usa contexto padrão e mensagens fallback genéricas
 *
 * @example
 * ```tsx
 * const { onError } = useSimpleErrorHandler("ShoppingList");
 *
 * try {
 *   await saveItem();
 * } catch (err) {
 *   onError(err);
 * }
 * ```
 */
export function useSimpleErrorHandler(context: string) {
    const { handleError } = useErrorHandler({ context });

    const onError = useCallback(
        (error: unknown, message?: string) => {
            handleError(error, { message });
        },
        [handleError]
    );

    return { onError };
}
