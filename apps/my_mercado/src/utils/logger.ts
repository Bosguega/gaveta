/* eslint-disable no-console */
/**
 * Logger centralizado para a aplicação
 * Em produção, logs são desabilitados para melhor performance
 * Em desenvolvimento, logs são exibidos no console
 */

import type { ErrorCode } from "./errorCodes";

const isDev = import.meta.env.DEV;

export const logger = {
    /**
     * Log de erro - sempre visível em desenvolvimento
     * @param context - Contexto do erro (ex: "saveReceipt", "loadDictionary")
     * @param message - Mensagem de erro
     * @param error - Erro capturado
     * @param code - Código de erro para rastreabilidade (opcional)
     */
    error: (context: string, message: string, error?: unknown, code?: ErrorCode) => {
        if (isDev) {
            const codeStr = code ? ` [${code}]` : "";
            if (error !== undefined) {
                console.error(`[${context}] ${message}${codeStr}`, error);
            } else {
                console.error(`[${context}] ${message}${codeStr}`);
            }
        }
        // TODO: Em produção, enviar para serviço de monitoring (Sentry, etc)
    },

    /**
     * Log de warning - sempre visível em desenvolvimento
     * @param context - Contexto do warning
     * @param message - Mensagem de warning
     * @param data - Dados adicionais opcionais
     * @param code - Código de erro para rastreabilidade (opcional)
     */
    warn: (context: string, message: string, data?: unknown, code?: ErrorCode) => {
        if (isDev) {
            const codeStr = code ? ` [${code}]` : "";
            if (data !== undefined) {
                console.warn(`[${context}] ${message}${codeStr}`, data);
            } else {
                console.warn(`[${context}] ${message}${codeStr}`);
            }
        }
    },

    /**
     * Log de informação - apenas em desenvolvimento
     * @param context - Contexto da informação
     * @param message - Mensagem informativa
     * @param data - Dados adicionais opcionais
     */
    info: (context: string, message: string, data?: unknown) => {
        if (isDev) {
            if (data !== undefined) {
                console.log(`[${context}] ${message}`, data);
            } else {
                console.log(`[${context}] ${message}`);
            }
        }
    },

    /**
     * Log de debug - apenas em desenvolvimento
     * @param context - Contexto do debug
     * @param message - Mensagem de debug
     * @param data - Dados adicionais opcionais
     */
    debug: (context: string, message: string, data?: unknown) => {
        if (isDev) {
            if (data !== undefined) {
                console.debug(`[${context}] ${message}`, data);
            } else {
                console.debug(`[${context}] ${message}`);
            }
        }
    },
};
