import { useMemo } from "react";
import { parseBRL } from "../../utils/currency";
import { parseToDate } from "../../utils/date";
import { groupBy } from "../../utils/analytics";
import type { PurchasedItem } from "../../types/ui";
import type { CanonicalProduct } from "../../types/domain";

interface UseSearchChartDataReturn {
  /** Dados agrupados por produto (para legenda do gráfico) */
  groupedItems: Record<string, PurchasedItem[]>;
  /** Dados formatados para o gráfico de linhas */
  chartData: Array<Record<string, string | number>>;
}

/**
 * Hook que prepara dados para o gráfico de tendência de preços.
 *
 * Responsabilidade:
 * - Agrupar items por produto (canonical ou nome)
 * - Calcular datas únicas
 * - Mapear preços por data
 *
 * @param filteredItems - Items já filtrados e ordenados
 * @param canonicalProducts - Produtos canônicos para nomeação
 * @param showChart - Controle de exibição do gráfico
 *
 * @example
 * ```tsx
 * const { groupedItems, chartData } = useSearchChartData(
 *   filteredItems,
 *   canonicalProducts,
 *   showChart
 * );
 * ```
 */
export function useSearchChartData(
  filteredItems: PurchasedItem[],
  canonicalProducts: CanonicalProduct[],
  showChart: boolean
): UseSearchChartDataReturn {
  // Agrupar items por canonical ID ou nome
  const groupedItems = useMemo(() => {
    return groupBy(filteredItems, (i) => {
      if (i.canonical_product_id) {
        const vip = canonicalProducts.find((cp) => cp.id === i.canonical_product_id);
        return vip ? `💎 ${vip.name}` : (i.normalized_name || i.name);
      }
      return i.normalized_name || i.name;
    });
  }, [filteredItems, canonicalProducts]);

  // Calcular dados do gráfico
  const chartData = useMemo(() => {
    if (!showChart) return [];

    // 1. Coletar todas as datas únicas
    const allDates = new Set<string>();
    Object.keys(groupedItems).forEach((key) => {
      groupedItems[key].forEach((historyItem: PurchasedItem) => {
        if (historyItem.purchasedAt) {
          const d = parseToDate(historyItem.purchasedAt);
          if (d) {
            allDates.add(d.toISOString().substring(0, 10));
          }
        }
      });
    });

    // 2. Ordenar datas cronologicamente
    const sortedDates = Array.from(allDates).sort((a, b) => {
      const dateA = parseToDate(a);
      const dateB = parseToDate(b);
      const timeA = dateA ? dateA.getTime() : 0;
      const timeB = dateB ? dateB.getTime() : 0;
      return timeA - timeB;
    });

    // 3. Mapear dados por data
    return sortedDates.map((dateStr) => {
      const dataPoint: Record<string, string | number> = { date: dateStr };
      Object.keys(groupedItems).forEach((itemName) => {
        const match = groupedItems[itemName].find(
          (h) => {
            if (!h.purchasedAt) return false;
            const d = parseToDate(h.purchasedAt);
            return d && d.toISOString().startsWith(dateStr);
          }
        );
        if (match) {
          dataPoint[itemName] = parseBRL(match.price);
        }
      });
      return dataPoint;
    });
  }, [showChart, groupedItems]);

  return {
    groupedItems,
    chartData,
  };
}
