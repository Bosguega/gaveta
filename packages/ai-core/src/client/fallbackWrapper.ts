/**
 * Fallback Wrapper
 *
 * Wrapper que permite fallback entre dois ProviderClients.
 * Útil para tentar um provider secundário (ex: Gemini) se o primário falhar.
 *
 * Responsabilidade única: tentar provider alternativo em caso de falha.
 */

import type { ProviderClient, GenerateTextOptions, GenerateTextResult, TestConnectionResult } from './types'

/**
 * Envolve dois ProviderClients com lógica de fallback.
 *
 * - Tenta o primary primeiro.
 * - Se falhar, tenta o secondary.
 * - testConnection usa apenas o primary.
 */
export function withFallback(
    primary: ProviderClient,
    secondary: ProviderClient
): ProviderClient {
    return {
        generateText: async (opts: GenerateTextOptions): Promise<GenerateTextResult> => {
            try {
                return await primary.generateText(opts)
            } catch (primaryError) {
                // Tenta o secondary como fallback
                try {
                    return await secondary.generateText(opts)
                } catch {
                    // Se ambos falharem, propaga o erro do primary
                    throw primaryError
                }
            }
        },

        testConnection: async (): Promise<TestConnectionResult> => {
            return primary.testConnection()
        },
    }
}