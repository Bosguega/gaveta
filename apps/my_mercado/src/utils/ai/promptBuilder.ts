/**
 * AI Prompt Builder
 *
 * Constrói prompts para normalização de produtos de supermercado
 */

import { CATEGORIES } from "../../constants/domain";
import type { AiNormalizationInput } from "../../types/ai";
import { logger } from "../logger";
import { extractJsonFromResponse } from '@bosguega/ai-core';
import { normalizeCategory } from "../categoryNormalizer";

/**
 * Constrói o prompt para normalização de itens
 */
export function buildNormalizationPrompt(items: AiNormalizationInput[]): string {
  const list = items.map((i) => `- key: "${i.key}", raw: "${i.raw}"`).join("\n");
  const categoriesList = CATEGORIES.join(", ");

  return `Voce e um especialista em normalizar nomes de produtos de supermercado brasileiro.
Para cada item abaixo, converta o nome bruto (muitas vezes abreviado e em letras maiusculas) em um nome amigavel, legivel e bem formatado.

REGRAS:
1. MANTENHA volumes e pesos (ex: 1L, 2L, 350ml, 500g, 5kg, 1.5L).
2. MANTENHA variantes importantes (ex: Zero, Integral, Desnatado, Sem Lactose, Diet, Light).
3. Converta abreviacoes comuns para o nome completo (ex: "CERV" -> "Cerveja", "LTA" -> "Lata", "BISC" -> "Biscoito", "REFR" -> "Refrigerante").
4. Use Title Case (Primeira Letra Maiuscula).
5. Categorize usando EXATAMENTE uma das seguintes opcoes, com a grafia exata (preservando acentos como em Laticinios, Acougue, Hortifruti): ${categoriesList}.
6. Se nenhuma categoria se encaixar, use "Outros" (com O maiusculo).

EXEMPLOS:
- "CERV BRAHMA LTA 350ML" -> {"key": "...", "normalized_name": "Cerveja Brahma Lata 350ml", "category": "Bebidas"}
- "LEITE PIRACANJUBA INT 1L" -> {"key": "...", "normalized_name": "Leite Piracanjuba Integral 1L", "category": "Laticínios"}
- "ACEM MOIDO KG" -> {"key": "...", "normalized_name": "Acem Moido", "category": "Acougue"}

Itens para processar:
${list}

Responda SOMENTE com o JSON array no formato: [{"key": "...", "normalized_name": "...", "category": "..."}], sem explicacoes.`;
}

/**
 * Parse de resposta JSON da IA
 */
export function parseAiJsonResponse(text: string) {
  try {
    const parsed = extractJsonFromResponse(text);
    if (!Array.isArray(parsed)) {
      throw new Error("Resposta da IA nao e um array.");
    }

    return parsed.map((entry) => {
      if (entry && typeof entry === "object") {
        const value = entry as Record<string, unknown>;
        return {
          key: String(value.key ?? ""),
          normalized_name: String(value.normalized_name ?? ""),
          category: normalizeCategory(String(value.category ?? "")),
        };
      }

      return {
        key: "",
        normalized_name: "",
        category: "Outros",
      };
    });
  } catch (err) {
    logger.error("PromptBuilder", "Erro ao parsear resposta da IA", err);
    throw new Error("Resposta da IA nao e um JSON valido.");
  }
}
