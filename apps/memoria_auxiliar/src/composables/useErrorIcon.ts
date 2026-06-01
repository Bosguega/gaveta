import { computed, type ComputedRef } from 'vue'

/**
 * Mapeia códigos de erro de IA para ícones emoji apropriados.
 * Usado pelos layouts (Mobile/Desktop) ao renderizar o `error-banner`.
 */
const ICON_BY_CODE: Record<string, string> = {
    INVALID_API_KEY: '🔑',
    RATE_LIMIT_EXCEEDED: '⏳',
    NETWORK_ERROR: '🌐',
    TIMEOUT: '🌐',
    SERVICE_UNAVAILABLE: '🔧',
    SERVER_ERROR: '🔧',
}

const DEFAULT_ICON = '⚠️'

export function useErrorIcon(code: string | null | undefined): ComputedRef<string> {
    return computed(() => {
        if (!code) return DEFAULT_ICON
        return ICON_BY_CODE[code] ?? DEFAULT_ICON
    })
}
