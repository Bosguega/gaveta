import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { getReceiptItemsFromDB, getReceiptsPaginated } from "../../services";
import type { HistoryFilters } from "../../types/ui";

// Query keys para cache
export const receiptKeys = {
    all: ["receipts"] as const,
    lists: () => [...receiptKeys.all, "list"] as const,
    list: (filters: HistoryFilters, search?: string) => [...receiptKeys.lists(), filters, search] as const,
    infinites: () => [...receiptKeys.all, "infinite"] as const,
    infinite: (filters: HistoryFilters, search?: string) => [...receiptKeys.infinites(), filters, search] as const,
    details: () => [...receiptKeys.all, "detail"] as const,
    detail: (id: string) => [...receiptKeys.details(), id] as const,
};

/**
 * Hook para query simples com paginação
 */
export function useReceiptsQuery(
    page: number = 1,
    pageSize: number = 20,
    filters?: HistoryFilters,
    search?: string
) {
    return useQuery({
        queryKey: receiptKeys.list(filters || {} as HistoryFilters, search),
        queryFn: () => getReceiptsPaginated(page, pageSize, {
            search,
            period: filters?.period,
            startDate: filters?.startDate,
            endDate: filters?.endDate,
            sortBy: filters?.sortBy,
            sortOrder: filters?.sortOrder,
        }),
        staleTime: 2 * 60 * 1000, // 2 minutos
    });
}

/**
 * Hook para query infinita (paginação automática)
 */
export function useInfiniteReceiptsQuery(
    pageSize: number = 20,
    filters?: HistoryFilters,
    search?: string
) {
    return useInfiniteQuery({
        queryKey: receiptKeys.infinite(filters || {} as HistoryFilters, search),
        queryFn: ({ pageParam = 1 }) =>
            getReceiptsPaginated(pageParam, pageSize, {
                search,
                period: filters?.period,
                startDate: filters?.startDate,
                endDate: filters?.endDate,
                sortBy: filters?.sortBy,
                sortOrder: filters?.sortOrder,
            }),
        getNextPageParam: (lastPage, pages) =>
            lastPage.hasMore ? pages.length + 1 : undefined,
        initialPageParam: 1,
        staleTime: 2 * 60 * 1000,
    });
}

/**
 * Hook para carregar itens de um receipt sob demanda.
 */
export function useReceiptItemsQuery(receiptId: string, enabled: boolean = true) {
    return useQuery({
        queryKey: receiptKeys.detail(receiptId),
        queryFn: () => getReceiptItemsFromDB(receiptId),
        enabled: enabled && Boolean(receiptId),
        staleTime: 5 * 60 * 1000,
    });
}

// Re-export dos hooks de mutation para backward compatibility
export { useSaveReceiptMutation as useSaveReceipt } from "./useSaveReceiptMutation";
export { useAllReceiptsQuery } from "./useAllReceiptsQuery";
export { useDeleteReceiptMutation as useDeleteReceipt } from "./useDeleteReceiptMutation";
export { useRestoreReceiptsMutation as useRestoreReceipts } from "./useRestoreReceiptsMutation";
