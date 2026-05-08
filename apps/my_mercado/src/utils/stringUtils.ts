/**
 * Utilitários de String
 *
 * Funções para manipulação e normalização de strings.
 */

/**
 * Remove informações de peso variável do nome do produto
 */
export function stripVariableInfo(
  name: string | undefined,
  unit: string | undefined,
  qty: string | number | undefined,
): string {
  if (!name) return "";

  const cleanName = name
    .replace(/(?<!\d)\s+(KG|G|ML|L|UN|PC|CX)\b$/i, "")
    .trim();

  const qtyNum = parseFloat(String(qty || "0").replace(",", "."));

  if (unit === "KG" && qtyNum < 5) {
    return cleanName.replace(/\b\d+[.,]?\d*\s?(KG|G)\b/gi, "").trim();
  }

  return cleanName;
}

/**
 * Limpa nome após processamento da IA
 */
export function cleanAIName(name: string): string {
  if (!name) return "";

  return name.replace(/\s+/g, " ").trim();
}

/**
 * Normaliza string para slug (lowercase, sem espaços, sem caracteres especiais)
 */
export function toSlug(value: string): string {
  const base = (value || "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
  return base || "default";
}

/**
 * Normaliza string para key de armazenamento
 */
export function toStoreSlug(value: string): string {
  return toSlug(value) || "mercado";
}

/**
 * Capitaliza primeira letra de cada palavra
 */
export function toTitleCase(str: string): string {
  return str.replace(
    /\w\S*/g,
    (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
  );
}

/**
 * Remove acentos e caracteres especiais
 */
export function removeAccents(str: string): string {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/**
 * Trunca string com reticências
 */
export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + "...";
}
