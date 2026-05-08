/**
 * Normaliza uma string para ser usada como chave determinística.
 * - Remove acentos (NFD + regex unicode)
 * - Converte para UPPERCASE
 * - Padroniza separadores (hifen, barra, ponto, virgula -> espaço)
 * - Mantém apenas letras A-Z, números e espaços
 * - Normaliza espaços duplicados e faz trim
 *
 * @param {string} name - O nome original do produto
 * @returns {string} - A chave normalizada
 */
export function normalizeKey(name: string): string {
  if (!name) return "";

  const normalized = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[,]/g, ".") // Padroniza vírgula para ponto (ex: 1,5L -> 1.5L)
    .replace(/[-_/]/g, " ") // Mantém pontos por enquanto
    .replace(/[^A-Z0-9\s.]/g, "") // Mantém letras, números, espaços e ponto
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\.$/g, ""); // Remove ponto no final se houver

  return normalized;
}
