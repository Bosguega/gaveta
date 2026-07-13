export function logInfo(message: string, data?: unknown): void {
    console.log(
        JSON.stringify({
            level: "info",
            message,
            ...(data !== undefined ? { data } : {}),
        }),
    );
}

export function logWarn(message: string, data?: unknown): void {
    console.warn(
        JSON.stringify({
            level: "warn",
            message,
            ...(data !== undefined ? { data } : {}),
        }),
    );
}

export function logError(message: string, data?: unknown): void {
    console.error(
        JSON.stringify({
            level: "error",
            message,
            ...(data !== undefined ? { data } : {}),
        }),
    );
}