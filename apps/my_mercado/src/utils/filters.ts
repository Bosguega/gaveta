/**
 * Utilitários de Filtro e Ordenação
 *
 * Funções puras para filtrar e ordenar dados.
 */

import { parseToDate } from "./date";
import { parseBRL } from "./currency";
import type { Receipt, CanonicalProduct, DictionaryEntry } from "../types/domain";
import type { HistoryFilters, SearchFilters } from "../types/ui";
import { startOfMonth, endOfMonth, subMonths, isWithinInterval } from "date-fns";
import { filterObjectsByTokens } from "./search";

// Configuração centralizada de campos pesquisáveis por entidade
export const SEARCH_CONFIG: {
  receipt: (keyof Receipt)[];
  canonicalProduct: (keyof CanonicalProduct)[];
  dictionary: (keyof DictionaryEntry)[];
} = {
  receipt: ["establishment"],
  canonicalProduct: ["name", "slug", "category", "brand"],
  dictionary: ["key", "normalized_name"],
};

// ==============================
// Utilitários de Período
// ==============================

export function getPeriodDateRange(
  period: string,
  startDate?: string,
  endDate?: string
): { start: Date; end: Date } | null {
  if (period === "all") return null;

  const now = new Date();

  if (period === "this-month") {
    return {
      start: startOfMonth(now),
      end: endOfMonth(now),
    };
  }

  if (period === "last-3-months") {
    // Últimos 3 meses completos (mês atual + 2 anteriores)
    return {
      start: startOfMonth(subMonths(now, 2)),
      end: endOfMonth(now),
    };
  }

  if (period === "custom" && startDate && endDate) {
    const start = parseToDate(startDate);
    const end = parseToDate(endDate);

    if (start && end && start <= end) {
      const intervalEnd = new Date(end);
      intervalEnd.setHours(23, 59, 59, 999);
      return { start, end: intervalEnd };
    }
  }

  return null;
}

// ==============================
// Funções Genéricas
// ==============================

/**
 * Filtra items por termo de busca em múltiplos campos usando busca tokenizada.
 *
 * A busca divide o texto por espaços e trata cada parte como token independente.
 * Tokens com prefixo "-" são negativos (excluem itens).
 * Ignora maiúsculas/minúsculas e acentos.
 *
 * Exemplo: "leite -doce" → mostra "leite 1L", remove "doce de leite"
 */
export function filterBySearch<T extends object>(
  items: T[],
  query: string,
  fields: (keyof T)[],
): T[] {
  if (!query) return items;
  return filterObjectsByTokens(query, items, fields);
}

/**
 * Ordena items por critério com suporte a custom sorters
 */
export function sortItems<T extends object>(
  items: T[],
  sortBy: string,
  direction: "asc" | "desc",
  customSorters: Record<string, (a: T, b: T) => number> = {},
): T[] {
  const sorted = [...items];

  if (customSorters[sortBy]) {
    sorted.sort((a, b) =>
      direction === "asc"
        ? customSorters[sortBy](a, b)
        : customSorters[sortBy](b, a)
    );
    return sorted;
  }

  return sorted;
}

// ==============================
// Funções Específicas para Receipts
// ==============================

/**
 * Filtra receipts por termo de busca (estabelecimento)
 */
export function filterReceiptsBySearch(receipts: Receipt[], search: string): Receipt[] {
  return filterBySearch(receipts, search, SEARCH_CONFIG.receipt);
}

/**
 * Filtra receipts por período
 */
export function filterByPeriod(
  receipts: Receipt[],
  period: HistoryFilters["period"],
  startDate?: string,
  endDate?: string
): Receipt[] {
  if (period === "all") return receipts;
  const range = getPeriodDateRange(period, startDate, endDate);
  if (!range) return [];

  return receipts.filter((receipt) => {
    const receiptDate = parseToDate(receipt.date);
    if (!receiptDate) return false;
    return isWithinInterval(receiptDate, range);
  });
}

/**
 * Filtra items por período (baseado em purchasedAt)
 */
export function filterItemsByPeriod<T extends { purchasedAt?: string }>(
  items: T[],
  period: SearchFilters["period"],
  startDate?: string,
  endDate?: string
): T[] {
  if (period === "all") return items;
  const range = getPeriodDateRange(period, startDate, endDate);
  if (!range) return [];

  return items.filter((item) => {
    if (!item.purchasedAt) return false;
    const itemDate = parseToDate(item.purchasedAt);
    if (!itemDate) return false;
    return isWithinInterval(itemDate, range);
  });
}

/**
 * Ordena receipts por critério
 */
export function sortReceipts(
  receipts: Receipt[],
  sortBy: HistoryFilters["sortBy"],
  sortOrder: HistoryFilters["sortOrder"]
): Receipt[] {
  return [...receipts].sort((a, b) => {
    if (sortBy === "date") {
      const timeA = parseToDate(a.date)?.getTime() || -Infinity;
      const timeB = parseToDate(b.date)?.getTime() || -Infinity;
      return sortOrder === "asc" ? timeA - timeB : timeB - timeA;
    }
    if (sortBy === "value") {
      const totalA = a.items.reduce(
        (acc, item) => acc + parseBRL(item.price || "0") * (item.quantity || 1),
        0
      );
      const totalB = b.items.reduce(
        (acc, item) => acc + parseBRL(item.price || "0") * (item.quantity || 1),
        0
      );
      return sortOrder === "asc" ? totalA - totalB : totalB - totalA;
    }
    if (sortBy === "store") {
      const storeA = (a.establishment || "").toLowerCase();
      const storeB = (b.establishment || "").toLowerCase();
      return sortOrder === "asc" ? storeA.localeCompare(storeB) : storeB.localeCompare(storeA);
    }
    return 0;
  });
}

/**
 * Aplica todos os filtros em receipts
 */
export function applyReceiptFilters(
  receipts: Receipt[],
  search: string,
  filters: HistoryFilters
): { items: Receipt[]; totalCount: number } {
  let filtered = filterReceiptsBySearch(receipts, search);
  filtered = filterByPeriod(filtered, filters.period, filters.startDate, filters.endDate);
  filtered = sortReceipts(filtered, filters.sortBy, filters.sortOrder);
  return {
    items: filtered,
    totalCount: filtered.length,
  };
}
