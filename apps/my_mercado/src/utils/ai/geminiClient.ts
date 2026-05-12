/**
 * Gemini Client — Adapter
 *
 * Este arquivo existe para compatibilidade com imports existentes.
 * Delega para o client do @bosguega/ai-core.
 *
 * @deprecated Importe diretamente de '@bosguega/ai-core' em novos códigos.
 */

import type { AiNormalizationInput, AiNormalizationResult } from '../../types/ai'
import { buildNormalizationPrompt, parseAiJsonResponse } from './promptBuilder'
import { createGeminiClient } from '@bosguega/ai-core'

/**
 * Chama a API do Gemini para normalizar itens
 */
export async function callGemini(
  items: AiNormalizationInput[],
  apiKey: string,
  model: string,
): Promise<AiNormalizationResult[]> {
  const client = createGeminiClient(apiKey, model)
  const result = await client.generateText({
    userPrompt: buildNormalizationPrompt(items),
    temperature: 0.2,
    maxTokens: 2048,
  })
  return parseAiJsonResponse(result.text)
}

/**
 * Testa conexão com a API do Gemini
 */
export async function testGeminiConnection(
  apiKey: string,
  model: string,
): Promise<{ success: boolean; error?: string }> {
  const client = createGeminiClient(apiKey, model)
  return client.testConnection()
}