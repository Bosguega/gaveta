const PREFIX = '[MemoriaAuxiliar]';

export const logger = {
    log: (context: string, message: string) => {
        console.log(`${PREFIX} [${context}] ${message}`);
    },
    warn: (context: string, message: string) => {
        console.warn(`${PREFIX} [${context}] ${message}`);
    },
    error: (context: string, message: string, error?: unknown) => {
        console.error(`${PREFIX} [${context}] ${message}`, error ?? '');
    },
};