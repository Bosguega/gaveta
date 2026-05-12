/**
 * AI Client - Unified Entry Point (Adapter)
 *
 * Ponto de entrada unificado para chamadas de IA.
 * Delega toda a orquestração para @bosguega/ai-core.
 *
 * @deprecated Importe '@bosguega/ai-core' e use createAiClient() em novos códigos.
 */

import { createAiClient } from '@bosguega/ai-core'
import { buildNormalizationPrompt, parseAiJsonResponse } from './promptBuilder'
import { logger } from '../logger'
import type { AiNormalizationInput, AiNormalizationResult } from '../../types/ai'

/**
 * Chama o provedor de IA para normalizar uma lista de itens.
 * O retry automático com backoff exponencial é gerenciado pelo core.
 */
export async function callAI(
  items: AiNormalizationInput[],
): Promise<AiNormalizationResult[]> {
  try {
    const ai = createAiClient()
    const result = await ai.generateText({
      userPrompt: buildNormalizationPrompt(items),
      temperature: 0.2,
      maxTokens: 2048,
    })
    return parseAiJsonResponse(result.text)
  } catch (err) {
    // Fallback: retorna itens sem normalização
    logger.error('AI', 'Falha ao chamar IA, usando fallback', err)
    return items.map((item) => ({
      key: item.key,
      normalized_name: item.raw,
      category: 'Outros',
    }))
  }
}

/**
 * Testa conexão com a IA.
 * Usa o client do core que gerencia provider internamente.
 */
export async function testAiConnection(
  apiKey: string,
  model: string,
): Promise<{ success: boolean; error?: string }> {
  if (!apiKey) return { success: false, error: 'API Key não informada' }

  try {
    const ai = createAiClient({ model })
    return await ai.testConnection()
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido'
    logger.warn('AI', 'Teste de conexao falhou', err)
    return { success: false, error: errorMessage }
  }
}