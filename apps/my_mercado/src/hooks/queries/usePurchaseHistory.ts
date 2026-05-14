import { useMemo } from "react";
import { parseToDate } from "../../utils/date";
import { logger } from "../../utils/logger";
import { toText } from "../../utils/shoppingList";
import { normalizeKey } from "../../utils/normalize";
import type { Receipt, ReceiptItem, CanonicalProduct } from "../../types/domain";

export type PurchaseHistoryEntry = {
  key: string;
  name: string;
  store: string;
  date: string;
  timestamp: number;
  unitPrice: number;
  quantity: number;
  total: number;
};

export type PurchaseSuggestion = {
  key: string;
  label: string;
  count: number;
  category?: string;
  canonical_name?: string;
  /** Último preço unitário pago (para exibir no autocomplete) */
  lastPrice?: number;
  /** Último mercado onde foi comprado */
  lastStore?: string;
};

interface UsePurchaseHistoryReturn {
  /** Mapa de histórico por chave normalizada */
  historyByKey: Map<string, PurchaseHistoryEntry[]>;
  /** Sugestões de items mais comprados */
  suggestions: PurchaseSuggestion[];
}

/**
 * Hook que monta histórico de compras a partir dos receipts.
 *
 * Responsabilidade:
 * - Extrair items de todos os receipts
 * - Agrupar por chave normalizada
 * - Ordenar por data (mais recente primeiro)
 * - Gerar sugestões baseadas na frequência
 *
 * @param savedReceipts - Lista de receipts
 * @param canonicalProducts - Lista de produtos canônicos
 *
 * @example
 * ```tsx
 * const { historyByKey, suggestions } = usePurchaseHistory(savedReceipts, canonicalProducts);
 *
 * // Buscar histórico de um item
 * const history = historyByKey.get(normalizedKey);
 *
 * // Sugestões para autocomplete com preço e mercado
 * suggestions[0] // { label: "Arroz Tio João", count: 3, lastPrice: 28.9, lastStore: "Mercado Silva" }
 * ```
 */
export function usePurchaseHistory(
  savedReceipts: Receipt[],
  canonicalProducts: CanonicalProduct[] = [],
): UsePurchaseHistoryReturn {
  return useMemo(() => {
    const map = new Map<string, PurchaseHistoryEntry[]>();
    const labels = new Map<
      string,
      {
        label: string;
        count: number;
        lastTimestamp: number;
        category?: string;
        canonical_name?: string;
        /** Último preço unitário registrado */
        lastPrice?: number;
        /** Último mercado registrado */
        lastStore?: string;
      }
    >();

    try {
      const safeReceipts = Array.isArray(savedReceipts) ? savedReceipts : [];

      for (const receipt of safeReceipts) {
        const date = toText(receipt?.date);
        const timestamp = parseToDate(date)?.getTime() ?? 0;
        const store = toText(receipt?.establishment).trim() || "Mercado";
        const receiptItems = Array.isArray(receipt?.items) ? receipt.items : [];

        for (const item of receiptItems) {
          const current = item as ReceiptItem;
          const name = toText(current.normalized_name || current.name).trim();
          const key = normalizeKey(
            toText(current.normalized_key).trim() || name || toText(current.name),
          );

          if (!key) continue;

          const quantity = current.quantity || 1;
          const unitPrice = current.price || 0;
          const total = current.total ?? unitPrice * quantity;

          const list = map.get(key) || [];
          list.push({
            key,
            name: name || toText(current.name) || "Item",
            store,
            date,
            timestamp,
            unitPrice,
            quantity: quantity || 1,
            total,
          });
          map.set(key, list);

          if (name) {
            const prev = labels.get(key);
            const vip = current.canonical_product_id
              ? canonicalProducts.find((p) => p.id === current.canonical_product_id)
              : null;
            const category = current.category || vip?.category || "";
            const canonical_name = vip?.name || "";

            if (prev) {
              prev.count += 1;
              if (timestamp > prev.lastTimestamp) {
                prev.lastTimestamp = timestamp;
                prev.label = name;
                prev.lastPrice = unitPrice;
                prev.lastStore = store;
              }
              if (!prev.category) prev.category = category;
              if (!prev.canonical_name) prev.canonical_name = canonical_name;
            } else {
              labels.set(key, {
                label: name,
                count: 1,
                lastTimestamp: timestamp,
                category,
                canonical_name,
                lastPrice: unitPrice,
                lastStore: store,
              });
            }
          }
        }
      }

      // Incluir produtos canônicos que talvez não tenham sido comprados ainda
      for (const product of canonicalProducts) {
        const name = toText(product.name).trim();
        const key = normalizeKey(name);
        if (!key) continue;

        const prev = labels.get(key);
        if (prev) {
          prev.label = name;
          if (!prev.category) prev.category = product.category;
          if (!prev.canonical_name) prev.canonical_name = product.name;
        } else {
          labels.set(key, {
            label: name,
            count: 0,
            lastTimestamp: 0,
            category: product.category,
            canonical_name: product.name,
          });
        }
      }

      // Ordenar histórico por data (mais recente primeiro)
      for (const [, entries] of map) {
        entries.sort((a, b) => b.timestamp - a.timestamp);
      }

      // Gerar sugestões ordenadas por frequência
      const suggestionItems = Array.from(labels.entries())
        .map(([key, value]) => ({
          key,
          label: value.label,
          count: value.count,
          category: value.category,
          canonical_name: value.canonical_name,
          lastTimestamp: value.lastTimestamp,
          lastPrice: value.lastPrice,
          lastStore: value.lastStore,
        }))
        .sort(
          (a, b) =>
            b.count - a.count ||
            b.lastTimestamp - a.lastTimestamp ||
            a.label.localeCompare(b.label),
        )
        .slice(0, 1000)
        .map(({ key, label, count, category, canonical_name, lastPrice, lastStore }) => ({
          key,
          label,
          count,
          category,
          canonical_name,
          lastPrice,
          lastStore,
        }));

      return { historyByKey: map, suggestions: suggestionItems };
    } catch (err) {
      logger.error("PurchaseHistory", "Falha ao montar historico de compras para a lista", err);
      return { historyByKey: new Map<string, PurchaseHistoryEntry[]>(), suggestions: [] };
    }
  }, [savedReceipts, canonicalProducts]);
}