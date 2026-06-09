/**
 * Category Normalizer
 *
 * Converte qualquer string de categoria (vinda da IA, do usuário,
 * ou de dados legados) para a grafia canônica definida em CATEGORIES.
 *
 * - "Laticinios"   -> "Laticínios"
 * - "laticínios"   -> "Laticínios"
 * - " LATICINIOS " -> "Laticínios"
 * - "Bebidas"      -> "Bebidas"
 * - "qualquer"     -> "Outros"
 * - "" / null      -> "Outros"
 */

import { CATEGORIES, type Category } from "../constants/domain";

/**
 * Remove acentos via NFD + strip combining marks.
 * Mantém a string lowercased e trimada.
 */
function slugify(value: string): string {
    return value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase();
}

/**
 * Mapa slug -> categoria canônica (gerado a partir de CATEGORIES).
 * Mantido como objeto simples (não Map) para serialização amigável.
 */
const CATEGORY_SLUG_MAP: Record<string, Category> = CATEGORIES.reduce(
    (acc, category) => {
        acc[slugify(category)] = category;
        return acc;
    },
    {} as Record<string, Category>,
);

const FALLBACK: Category = "Outros";

/**
 * Normaliza uma string de categoria para a grafia canônica.
 *
 * @param input Valor bruto (pode vir da IA, de input do usuário,
 *              do banco, etc.).
 * @returns Categoria canônica (sempre uma das definidas em CATEGORIES).
 */
export function normalizeCategory(input: string | null | undefined): Category {
    if (!input) return FALLBACK;
    const slug = slugify(input);
    if (!slug) return FALLBACK;
    return CATEGORY_SLUG_MAP[slug] ?? FALLBACK;
}

/**
 * Aplica `normalizeCategory` a uma lista de entradas de dicionário.
 * Não muta o array original.
 */
export function normalizeDictionaryEntries<T extends { category?: string | null }>(
    entries: T[],
): T[] {
    return entries.map((entry) => ({
        ...entry,
        category: normalizeCategory(entry.category),
    }));
}
