/**
 * Funções puras para resolução e derivação de DeviceMode.
 *
 * Sem dependências de DOM, React, Vue ou qualquer framework.
 * São a parte "de contrato" compartilhada por todos os apps.
 */

import type { DeviceMode } from './types'

/**
 * Resolve um DeviceMode bruto em um modo concreto.
 *
 * Quando `mode === 'auto'`, usa `isDesktopViewport` para decidir entre
 * `'desktop'` e `'mobile'`. Para qualquer outro valor, devolve o próprio
 * `mode` (incluindo `'tablet'`, que é sempre explícito).
 *
 * @param mode              Modo armazenado (pode ser 'auto').
 * @param isDesktopViewport Estado do viewport de acordo com a media query
 *                          desktop (ver `DEVICE_DESKTOP_MEDIA_QUERY`).
 */
export function resolveDeviceMode(
    mode: DeviceMode,
    isDesktopViewport: boolean,
): DeviceMode {
    if (mode === 'auto') {
        return isDesktopViewport ? 'desktop' : 'mobile'
    }
    return mode
}

/**
 * Flags booleanas derivadas a partir do par (mode, resolvedMode).
 *
 * Útil para componentes que precisam de predicados sem ter que reimplementar
 * a lógica em cada framework. Por contrato, `isDesktop` retorna `true`
 * tanto para `desktop` quanto para `tablet` — tablets compartilham o
 * layout desktop por padrão.
 */
export interface DeviceFlags {
    /** `true` quando o modo resolvido é 'mobile'. */
    isMobile: boolean
    /** `true` quando o modo resolvido é 'tablet'. */
    isTablet: boolean
    /** `true` quando o modo resolvido é 'desktop' ou 'tablet'. */
    isDesktop: boolean
    /** `true` quando o modo *bruto* é 'auto' (não foi escolhido manualmente). */
    isAuto: boolean
}

export function deriveDeviceFlags(
    mode: DeviceMode,
    resolvedMode: DeviceMode,
): DeviceFlags {
    return {
        isMobile: resolvedMode === 'mobile',
        isTablet: resolvedMode === 'tablet',
        isDesktop: resolvedMode === 'desktop' || resolvedMode === 'tablet',
        isAuto: mode === 'auto',
    }
}
