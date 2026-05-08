/**
 * AI Prompt Builder
 *
 * Constrói prompts para normalização de produtos de supermercado
 */

import { CATEGORIES } from "../../constants/domain";
import type { AiNormalizationInput } from "../../types/ai";
import { logger } from "../logger";

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
5. Categorize em: ${categoriesList}.
6. IDENTIFIQUE a marca (Brand) se houver (ex: Nestlé, Brahma). Se não houver, use null.
7. GERE um slug único simplificado (ex: arroz_tio_joao_5kg).

EXEMPLOS:
- "CERV BRAHMA LTA 350ML" -> {"key": "...", "normalized_name": "Cerveja Brahma Lata 350ml", "category": "Bebidas", "brand": "Brahma", "slug": "cerveja_brahma_350ml"}
- "LEITE PIRACANJUBA INT 1L" -> {"key": "...", "normalized_name": "Leite Piracanjuba Integral 1L", "category": "Laticinios", "brand": "Piracanjuba", "slug": "leite_piracanjuba_integral_1l"}

Itens para processar:
${list}

Responda SOMENTE com o JSON array no formato: [{"key": "...", "normalized_name": "...", "category": "...", "brand": "...", "slug": "..."}], sem explicacoes.`;
}

/**
 * Parse de resposta JSON da IA
 */
export function parseAiJsonResponse(text: string) {
  // Remove possible markdown ```json ... ``` wrapper
  const cleaned = text
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();

  try {
    const parsed = JSON.parse(cleaned) as unknown;
    if (!Array.isArray(parsed)) {
      throw new Error("Resposta da IA nao e um array.");
    }

    return parsed.map((entry) => {
      if (entry && typeof entry === "object") {
        const value = entry as Record<string, unknown>;
        return {
          key: String(value.key ?? ""),
          normalized_name: String(value.normalized_name ?? ""),
          category: String(value.category ?? "Outros"),
          brand: value.brand ? String(value.brand) : undefined,
          slug: value.slug ? String(value.slug) : undefined,
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
