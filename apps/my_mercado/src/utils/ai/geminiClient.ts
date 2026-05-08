/**
 * Google AI Studio (Gemini) Client
 *
 * Cliente para integração com API do Google Gemini
 */

import { buildNormalizationPrompt, parseAiJsonResponse } from "./promptBuilder";
import type { AiNormalizationInput, AiNormalizationResult } from "../../types/ai";
import { AiApiError } from "./aiApiError";

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
}

/**
 * Chama a API do Gemini para normalizar itens
 */
export async function callGemini(
  items: AiNormalizationInput[],
  apiKey: string,
  model: string,
): Promise<AiNormalizationResult[]> {
  const key = apiKey.trim();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": key,
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: buildNormalizationPrompt(items) }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 2048,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    if (
      err.includes("API_KEY_INVALID") ||
      err.includes("API Key not found") ||
      err.includes('"reason": "API_KEY_INVALID"')
    ) {
      throw new AiApiError(
        "Chave inválida para o Gemini. Gere uma API key em https://aistudio.google.com/apikey. Se usar chave do Google Cloud, habilite a API Generative Language para esse projeto.",
        res.status,
      );
    }
    throw new AiApiError(`Gemini API Error (${res.status}): ${err}`, res.status);
  }

  const data = (await res.json()) as GeminiResponse;
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

  return parseAiJsonResponse(text);
}

/**
 * Testa conexão com a API do Gemini
 */
export async function testGeminiConnection(
  apiKey: string,
  model: string,
): Promise<{ success: boolean; error?: string }> {
  const testItems: AiNormalizationInput[] = [{ key: "TEST", raw: "ARROZ BRANCO 5KG" }];

  try {
    await callGemini(testItems, apiKey, model);
    return { success: true };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Erro desconhecido";
    return { success: false, error: errorMessage };
  }
}
