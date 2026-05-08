/**
 * OpenAI Client
 *
 * Cliente para integração com API OpenAI-compatible
 */

import { buildNormalizationPrompt, parseAiJsonResponse } from "./promptBuilder";
import type { AiNormalizationInput, AiNormalizationResult } from "../../types/ai";
import { AiApiError } from "./aiApiError";

interface OpenAIResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

/**
 * Chama a API OpenAI para normalizar itens
 */
export async function callOpenAI(
  items: AiNormalizationInput[],
  apiKey: string,
  model: string,
): Promise<AiNormalizationResult[]> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 2048,
      messages: [
        {
          role: "system",
          content:
            "Voce e um especialista em normalizar nomes de produtos de supermercado brasileiro. Responda SOMENTE com JSON.",
        },
        { role: "user", content: buildNormalizationPrompt(items) },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new AiApiError(`OpenAI API Error (${res.status}): ${err}`, res.status);
  }

  const data = (await res.json()) as OpenAIResponse;
  const text = data?.choices?.[0]?.message?.content || "";

  return parseAiJsonResponse(text);
}

/**
 * Testa conexão com a API OpenAI
 */
export async function testOpenAIConnection(
  apiKey: string,
  model: string,
): Promise<{ success: boolean; error?: string }> {
  const testItems: AiNormalizationInput[] = [{ key: "TEST", raw: "ARROZ BRANCO 5KG" }];

  try {
    await callOpenAI(testItems, apiKey, model);
    return { success: true };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Erro desconhecido";
    return { success: false, error: errorMessage };
  }
}
