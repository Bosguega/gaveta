import { useMemo } from "react";
import { parseToDate } from "../../utils/date";
import { logger } from "../../utils/logger";
import { toText } from "../../utils/shoppingList";
import { normalizeKey } from "../../utils/normalize";
import type { Receipt, ReceiptItem } from "../../types/domain";

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

  /** Último preço unitário pago (para exibir no autocomplete) */
  lastPrice?: number;
  /** Último mercado onde foi comprado */
  lastStore?: string;
};

interface UsePurchaseHistoryReturn {
  /** Mapa de histórico por chave normalizada */
  historyByKey: Map<string, PurchaseHistoryEntry[]>;
  /** Mapa de histórico por normalized_name */
  historyByName: Map<string, PurchaseHistoryEntry[]>;
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
 * const { historyByKey, suggestions } = usePurchaseHistory(savedReceipts);
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
            const category = current.category || "";

            if (prev) {
              prev.count += 1;
              if (timestamp > prev.lastTimestamp) {
                prev.lastTimestamp = timestamp;
                prev.label = name;
                prev.lastPrice = unitPrice;
                prev.lastStore = store;
              }
              if (!prev.category) prev.category = category;
              if (!prev.category) prev.category = category;
            } else {
              labels.set(key, {
                label: name,
                count: 1,
                lastTimestamp: timestamp,
                category,
                lastPrice: unitPrice,
                lastStore: store,
              });
            }
          }
        }
      }



      // Construir historyByName - indexado por normalized_name
      const nameMap = new Map<string, PurchaseHistoryEntry[]>();
      for (const [, entries] of map) {
        for (const entry of entries) {
          const nameKey = normalizeKey(entry.name || "");
          if (!nameKey) continue;
          const list = nameMap.get(nameKey) || [];
          list.push(entry);
          nameMap.set(nameKey, list);
        }
      }

      // Ordenar histórico por data (mais recente primeiro)
      for (const [, entries] of map) {
        entries.sort((a, b) => b.timestamp - a.timestamp);
      }
      for (const [, entries] of nameMap) {
        entries.sort((a, b) => b.timestamp - a.timestamp);
      }

      // Gerar sugestões ordenadas por frequência
      const suggestionItems = Array.from(labels.entries())
        .map(([key, value]) => ({
          key,
          label: value.label,
          count: value.count,
          category: value.category,
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
        .map(({ key, label, count, category, lastPrice, lastStore }) => ({
          key,
          label,
          count,
          category,
          lastPrice,
          lastStore,
        }));

      return { historyByKey: map, historyByName: nameMap, suggestions: suggestionItems };
    } catch (err) {
      logger.error("PurchaseHistory", "Falha ao montar historico de compras para a lista", err);
      return { historyByKey: new Map<string, PurchaseHistoryEntry[]>(), historyByName: new Map<string, PurchaseHistoryEntry[]>(), suggestions: [] };
    }
  }, [savedReceipts]);
}