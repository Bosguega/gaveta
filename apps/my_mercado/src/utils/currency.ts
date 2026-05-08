import currency from 'currency.js';

/**
 * Utilitários para tratamento de moedas no app My Mercado.
 * Usa Intl para formatação e currency.js para precisão aritmética.
 */

// Formato padrão para exibição em português do Brasil
const BRL_FORMATTER = new Intl.NumberFormat('pt-BR', {
  style: 'decimal',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Converte um valor (string ou número) para número, lidando com decimais brasileiros.
 * Aceita: "1.234,56", "1234,56", "1234.56", 1234.56
 */
export function parseBRL(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return value;

  // Se a string já estiver no formato decimal "clean" (ex: "123.45"), o currency.js lida bem.
  // Se contiver vírgula, precisamos garantir que o currency.js entenda que é decimal.
  const stringValue = String(value).trim();

  // Detecção de formato brasileiro: tem vírgula e se tiver ponto, o ponto vem antes da vírgula.
  if (stringValue.includes(',') && !stringValue.includes('.')) {
    // Caso simples: "12,34"
    return currency(stringValue.replace(',', '.')).value;
  }

  if (stringValue.includes(',') && stringValue.includes('.')) {
    // Caso complexo: "1.234,56"
    return currency(stringValue, { separator: '.', decimal: ',' }).value;
  }

  // Fallback: se tiver vírgula, substitui por ponto para o currency.js padrão
  return currency(stringValue.replace(',', '.')).value;
}

/**
 * Formata um número para o padrão brasileiro (ex: 1234.56 -> "1.234,56").
 * Não inclui o prefixo "R$ " por padrão para facilitar uso em inputs ou layouts customizados.
 */
export function formatBRL(value: string | number | null | undefined): string {
  const num = parseBRL(value);
  return BRL_FORMATTER.format(num);
}

/**
 * Formata um número com o prefixo de moeda (ex: 1234.56 -> "R$ 1.234,56").
 */
export function formatCurrency(value: string | number | null | undefined): string {
  const num = parseBRL(value);
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(num);
}

/**
 * Realiza cálculos seguros com precisão de centavos.
 */
export const calc = {
  add: (a: number, b: number) => currency(a).add(b).value,
  sub: (a: number, b: number) => currency(a).subtract(b).value,
  mul: (a: number, b: number) => currency(a).multiply(b).value,
  div: (a: number, b: number) => currency(a).divide(b).value,
};
