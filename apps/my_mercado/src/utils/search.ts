/**
 * Busca textual por tokens separados por espaço.
 *
 * Regras:
 * - Ignora maiúsculas/minúsculas e acentos
 * - Texto digitado é dividido por espaços em tokens independentes
 * - Tokens com prefixo "-" são negativos (excluem itens que contenham o token)
 * - Um item só aparece se TODOS os tokens positivos estiverem presentes (via includes)
 * - Nenhum token negativo pode estar presente no item
 *
 * Preparado para futura etapa de highlight dos trechos encontrados.
 */

import { normalizeKey } from "./normalize";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SearchToken {
  /** Token sem o prefixo negativo, já normalizado */
  text: string;
  /** True se o token começou com "-" (filtro negativo) */
  negative: boolean;
}

export interface MatchedRange {
  /** Índice inicial do trecho encontrado no texto original */
  start: number;
  /** Índice final (exclusive) do trecho encontrado no texto original */
  end: number;
  /** Token que causou o match */
  token: string;
}

export interface SearchResult {
  /** True se o item passou no filtro */
  match: boolean;
  /** Trechos encontrados para highlight (apenas se match === true) */
  highlights: MatchedRange[];
}

// ---------------------------------------------------------------------------
// Parser de query
// ---------------------------------------------------------------------------

/**
 * Divide a query em tokens, identificando negativos pelo prefixo "-".
 * Tokens vazios são descartados.
 */
export function parseQuery(query: string): SearchToken[] {
  const raw = query.trim().split(/\s+/).filter(Boolean);
  return raw.map((part) => {
    if (part.startsWith("-")) {
      return { text: normalizeKey(part.slice(1)), negative: true };
    }
    return { text: normalizeKey(part), negative: false };
  });
}

// ---------------------------------------------------------------------------
// Busca principal
// ---------------------------------------------------------------------------

/**
 * Busca um único token normalizado dentro de um texto normalizado.
 * Retorna os ranges encontrados no texto ORIGINAL (antes da normalização)
 * para suporte futuro de highlight.
 */
function findTokenInText(
  normalizedText: string,
  token: string,
  originalText: string,
): MatchedRange[] {
  const ranges: MatchedRange[] = [];
  const lowerToken = token.toLowerCase();
  const lowerText = normalizedText.toLowerCase();

  let index = 0;
  while (true) {
    const pos = lowerText.indexOf(lowerToken, index);
    if (pos === -1) break;
    // Mapear posição normalizada de volta para o texto original
    const mapped = mapNormalizedToOriginal(pos, pos + token.length, originalText, normalizedText);
    ranges.push({ start: mapped.start, end: mapped.end, token });
    index = pos + 1;
  }

  return ranges;
}

/**
 * Mapeia índices do texto normalizado de volta para o texto original.
 * Usa uma abordagem proporcional simples.
 */
function mapNormalizedToOriginal(
  normStart: number,
  normEnd: number,
  originalText: string,
  normalizedText: string,
): { start: number; end: number } {
  // Para textos curtos, busca direta via busca case-insensitive
  const snippet = normalizedText.slice(normStart, normEnd);
  const lowerOriginal = originalText.toLowerCase();
  // Precisamos lidar com acentos: busca aproximada
  const pos = fuzzyFind(lowerOriginal, snippet.toLowerCase());
  if (pos !== -1) {
    return { start: pos, end: pos + snippet.length };
  }
  // Fallback proporcional
  const ratio = originalText.length / (normalizedText.length || 1);
  return {
    start: Math.floor(normStart * ratio),
    end: Math.ceil(normEnd * ratio),
  };
}

/**
 * Busca `pattern` dentro de `text` tolerando diferenças de acentos.
 * Retorna o índice inicial ou -1.
 */
function fuzzyFind(text: string, pattern: string): number {
  if (!pattern) return -1;
  const len = pattern.length;
  for (let i = 0; i <= text.length - len; i++) {
    let match = true;
    for (let j = 0; j < len; j++) {
      const c1 = text[i + j].normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const c2 = pattern[j].normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (c1.toLowerCase() !== c2.toLowerCase()) {
        match = false;
        break;
      }
    }
    if (match) return i;
  }
  return -1;
}

/**
 * Avalia se uma string passa no filtro de tokens.
 * Retorna SearchResult com match e highlights para futura renderização.
 */
export function evaluateTokenSearch(
  tokens: SearchToken[],
  text: string,
): SearchResult {
  if (tokens.length === 0) {
    return { match: true, highlights: [] };
  }

  const normalizedText = normalizeKey(text);
  const allHighlights: MatchedRange[] = [];

  // Verifica tokens positivos: TODOS precisam estar presentes
  const positiveTokens = tokens.filter((t) => !t.negative);
  const negativeTokens = tokens.filter((t) => t.negative);

  for (const token of positiveTokens) {
    if (!normalizedText.toLowerCase().includes(token.text.toLowerCase())) {
      return { match: false, highlights: [] };
    }
    const ranges = findTokenInText(normalizedText, token.text, text);
    allHighlights.push(...ranges);
  }

  // Verifica tokens negativos: NENHUM pode estar presente
  for (const token of negativeTokens) {
    if (normalizedText.toLowerCase().includes(token.text.toLowerCase())) {
      return { match: false, highlights: [] };
    }
  }

  return { match: true, highlights: allHighlights };
}

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

/**
 * Filtra um array de strings usando busca tokenizada.
 * Retorna apenas os itens que passam no filtro.
 */
export function filterByTokens(query: string, items: string[]): string[] {
  const tokens = parseQuery(query);
  if (tokens.length === 0) return items;
  return items.filter((item) => evaluateTokenSearch(tokens, item).match);
}

/**
 * Filtra um array de objetos usando busca tokenizada em múltiplos campos.
 * Um item passa se TODOS os tokens positivos forem encontrados em
 * QUALQUER um dos campos (OR entre campos, AND entre tokens).
 * Tokens negativos: se baterem em qualquer campo, o item é excluído.
 */
export function filterObjectsByTokens<T extends object>(
  query: string,
  items: T[],
  fields: (keyof T)[],
): T[] {
  const tokens = parseQuery(query);
  if (tokens.length === 0) return items;

  return items.filter((item) => {
    // Para cada token positivo, verificar se existe em pelo menos um campo
    const positiveTokens = tokens.filter((t) => !t.negative);
    const negativeTokens = tokens.filter((t) => t.negative);

    // Todos os tokens positivos precisam encontrar match em algum campo
    for (const token of positiveTokens) {
      const foundInAnyField = fields.some((field) => {
        const value = (item as Record<string, unknown>)[field as string];
        const text = String(value ?? "");
        return normalizeKey(text)
          .toLowerCase()
          .includes(token.text.toLowerCase());
      });
      if (!foundInAnyField) return false;
    }

    // Nenhum token negativo pode encontrar match em qualquer campo
    for (const token of negativeTokens) {
      const foundInAnyField = fields.some((field) => {
        const value = (item as Record<string, unknown>)[field as string];
        const text = String(value ?? "");
        return normalizeKey(text)
          .toLowerCase()
          .includes(token.text.toLowerCase());
      });
      if (foundInAnyField) return false;
    }

    return true;
  });
}

/**
 * Constrói texto com marcação HTML para highlight dos trechos encontrados.
 * Usa <mark> como tag padrão (customizável).
 * Prepara para futura etapa visual de destaque.
 */
export function buildHighlightHtml(
  text: string,
  highlights: MatchedRange[],
  options?: { tag?: string; className?: string },
): string {
  if (highlights.length === 0) return escapeHtml(text);

  const tag = options?.tag ?? "mark";
  const className = options?.className ? ` class="${options.className}"` : "";

  // Ordenar e mesclar ranges sobrepostos
  const sorted = [...highlights].sort((a, b) => a.start - b.start);
  const merged = mergeRanges(sorted);

  let result = "";
  let cursor = 0;

  for (const range of merged) {
    // Texto antes do highlight
    if (range.start > cursor) {
      result += escapeHtml(text.slice(cursor, range.start));
    }
    // Texto destacado
    result += `<${tag}${className}>${escapeHtml(text.slice(range.start, range.end))}</${tag}>`;
    cursor = range.end;
  }

  // Texto restante após último highlight
  if (cursor < text.length) {
    result += escapeHtml(text.slice(cursor));
  }

  return result;
}

function mergeRanges(ranges: MatchedRange[]): MatchedRange[] {
  if (ranges.length === 0) return [];
  const merged: MatchedRange[] = [{ ...ranges[0] }];

  for (let i = 1; i < ranges.length; i++) {
    const last = merged[merged.length - 1];
    const current = ranges[i];
    if (current.start <= last.end) {
      // Overlap: estender
      last.end = Math.max(last.end, current.end);
    } else {
      merged.push({ ...current });
    }
  }

  return merged;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
