/**
 * AI Client - Unified Entry Point
 *
 * Ponto de entrada unificado para chamadas de IA.
 * Orquestra entre Gemini e OpenAI baseado no provider.
 */

import { getApiKey, getApiModel, detectProvider } from "../aiConfig";
import { callGemini, testGeminiConnection } from "./geminiClient";
import { callOpenAI, testOpenAIConnection } from "./openaiClient";
import { AiApiError } from "./aiApiError";
import { logger } from "../logger";
import type { AiNormalizationInput, AiNormalizationResult } from "../../types/ai";

const MAX_RETRIES = 2;
const RETRY_DELAY = 1000; // 1 second

/**
 * Chama o provedor de IA para normalizar uma lista de itens.
 * Inclui retry automático com backoff exponencial.
 */
export async function callAI(
  items: AiNormalizationInput[],
): Promise<AiNormalizationResult[]> {
  const apiKey = getApiKey();
  const model = getApiModel();

  if (!apiKey) {
    throw new Error("API Key nao configurada. Va em configuracoes e informe sua chave.");
  }

  const provider = detectProvider(apiKey);

  // Retry logic with exponential backoff
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        logger.warn('AI', `Tentativa ${attempt + 1}/${MAX_RETRIES + 1}...`);
        await delay(RETRY_DELAY * attempt); // Exponential backoff
      }

      if (provider === "Google AI Studio") {
        return await callGemini(items, apiKey, model);
      }

      if (provider === "OpenAI") {
        return await callOpenAI(items, apiKey, model);
      }

      throw new Error(
        "Provedor desconhecido para a chave fornecida. Prefixos suportados: AIza... (Google) ou sk-... (OpenAI).",
      );
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      logger.warn('AI', `Erro na tentativa ${attempt + 1}: ${lastError.message}`);

      // Não retentar em erros de cliente (4xx exceto 429 — rate limit pode ter retry)
      if (lastError instanceof AiApiError && lastError.isClientError()) {
        break;
      }
    }
  }

  // All retries failed - return fallback
  logger.error('AI', 'Todas as tentativas falharam, usando fallback');
  return items.map((item) => ({
    key: item.key,
    normalized_name: item.raw,
    category: "Outros",
  }));
}

/**
 * Testa conexão com a IA.
 */
export async function testAiConnection(apiKey: string, model: string): Promise<{ success: boolean; error?: string }> {
  if (!apiKey) return { success: false, error: "API Key não informada" };

  const provider = detectProvider(apiKey);

  try {
    if (provider === "Google AI Studio") {
      return await testGeminiConnection(apiKey, model);
    } else if (provider === "OpenAI") {
      return await testOpenAIConnection(apiKey, model);
    }
    return { success: false, error: "Provedor desconhecido. Use AIza... (Google) ou sk-... (OpenAI)" };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Erro desconhecido";
    logger.warn('AI', 'Teste de conexao falhou', err);
    return { success: false, error: errorMessage };
  }
}

// ==============================
// HELPERS
// ==============================

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
