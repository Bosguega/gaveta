import { useMemo } from "react";
import type { PurchasedItem } from "../../types/ui";
import type { Receipt, ReceiptItem } from "../../types/domain";

interface UseSearchItemsReturn {
  /** Todos os items achatados de receipts */
  items: PurchasedItem[];
  /** Estado de carregamento */
  isLoading: boolean;
}

/**
 * Hook que transforma receipts em items de busca.
 *
 * Responsabilidade:
 * - Fazer flatten de receipts → items
 * - Fazer merge com canonical products
 * - Adicionar metadados (purchasedAt, store)
 *
 * @param receipts - Lista de receipts
 * @param canonicalProducts - Lista de produtos canônicos
 *
 * @example
 * ```tsx
 * const { items: allItems, isLoading } = useSearchItems(savedReceipts);
 * ```
 */
export function useSearchItems(
  receipts: Receipt[],
): UseSearchItemsReturn {
  const isLoading = receipts.length === 0;

  const items = useMemo(() => {
    const allItems: PurchasedItem[] = [];

    receipts.forEach((receipt: Receipt) => {
      if (receipt && Array.isArray(receipt.items)) {
        receipt.items.forEach((item: ReceiptItem) => {
          allItems.push({
            ...item,
            purchasedAt: receipt.date,
            store: receipt.establishment,
          });
        });
      }
    });

    return allItems;
  }, [receipts]);

  return {
    items,
    isLoading,
  };
}
