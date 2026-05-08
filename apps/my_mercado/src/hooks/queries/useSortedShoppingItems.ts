import { useMemo } from "react";
import { parseToDate } from "../../utils/date";
import type { ShoppingListItem } from "../../types/ui";

/**
 * Hook que ordena items da lista de compras.
 *
 * Critérios de ordenação:
 * 1. Não verificados primeiro (checked = false)
 * 2. Por data de criação (mais recente primeiro)
 *
 * @param shoppingItems - Lista de items
 *
 * @example
 * ```tsx
 * const orderedItems = useSortedShoppingItems(shoppingItems);
 *
 * // Items não verificados aparecem primeiro
 * // Dentro de cada grupo, ordenados por created_at (desc)
 * ```
 */
export function useSortedShoppingItems(shoppingItems: ShoppingListItem[]): ShoppingListItem[] {
  return useMemo(() => {
    return [...shoppingItems].sort((a, b) => {
      // 1. Não verificados primeiro
      if (a.checked !== b.checked) return a.checked ? 1 : -1;

      // 2. Por data de criação (mais recente primeiro)
      const timeA = parseToDate(a.created_at)?.getTime() ?? 0;
      const timeB = parseToDate(b.created_at)?.getTime() ?? 0;
      return timeB - timeA;
    });
  }, [shoppingItems]);
}
