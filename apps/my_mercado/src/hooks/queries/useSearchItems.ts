import { useMemo } from "react";
import type { PurchasedItem } from "../../types/ui";
import type { Receipt, ReceiptItem, CanonicalProduct } from "../../types/domain";

interface UseSearchItemsReturn {
  /** Todos os items achatados de receipts com merge de canonical products */
  items: (PurchasedItem & { canonical_name?: string })[];
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
 * const { items: allItems, isLoading } = useSearchItems(savedReceipts, canonicalProducts);
 * ```
 */
export function useSearchItems(
  receipts: Receipt[],
  canonicalProducts: CanonicalProduct[]
): UseSearchItemsReturn {
  const isLoading = receipts.length === 0;

  const items = useMemo(() => {
    const allItems: (PurchasedItem & { canonical_name?: string })[] = [];

    receipts.forEach((receipt: Receipt) => {
      if (receipt && Array.isArray(receipt.items)) {
        receipt.items.forEach((item: ReceiptItem) => {
          const vip = item.canonical_product_id
            ? canonicalProducts.find((p) => p.id === item.canonical_product_id)
            : null;

          allItems.push({
            ...item,
            purchasedAt: receipt.date,
            store: receipt.establishment,
            canonical_name: vip?.name || undefined,
          });
        });
      }
    });

    return allItems;
  }, [receipts, canonicalProducts]);

  return {
    items,
    isLoading,
  };
}
