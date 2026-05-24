/**
 * AI Client - Unified Entry Point (Adapter)
 *
 * Ponto de entrada unificado para chamadas de IA.
 * Delega toda a orquestracao para @bosguega/ai-core.
 *
 * @deprecated Importe '@bosguega/ai-core' e use createAiClient() em novos codigos.
 */

import { createAiClient, type AIProvider, type AIMode } from '@bosguega/ai-core'
import { buildNormalizationPrompt, parseAiJsonResponse } from './promptBuilder'
import { logger } from '../logger'
import type { AiNormalizationInput, AiNormalizationResult } from '../../types/ai'

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
    logger.error('AI', 'Falha ao chamar IA, usando fallback', err)
    return items.map((item) => ({
      key: item.key,
      normalized_name: item.raw,
      category: 'Outros',
    }))
  }
}

export type AiConnectionStatus =
  | 'idle'
  | 'offline'
  | 'checking'
  | 'connected'
  | 'loading_model'
  | 'generating'
  | 'error'

export interface TestAiConnectionOptions {
  mode: AIMode
  provider: AIProvider
  apiKey?: string
  baseUrl?: string
  model: string
  onStatus?: (status: AiConnectionStatus) => void
}

export async function testAiConnection(
  options: TestAiConnectionOptions,
): Promise<{ success: boolean; error?: string }> {
  if (options.mode === 'online' && !options.apiKey) {
    return { success: false, error: 'API Key nao informada' }
  }

  try {
    options.onStatus?.('checking')
    const ai = createAiClient({
      provider: options.provider,
      apiKey: options.apiKey,
      model: options.model,
      baseUrl: options.baseUrl,
    })
    if (options.mode === 'local') {
      options.onStatus?.('loading_model')
    }
    options.onStatus?.('generating')
    return await ai.testConnection()
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido'
    logger.warn('AI', 'Teste de conexao falhou', err)
    return { success: false, error: errorMessage }
  }
}
