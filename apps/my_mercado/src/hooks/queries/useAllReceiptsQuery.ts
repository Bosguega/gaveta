import { useQuery } from "@tanstack/react-query";
import { getAllReceiptsFromDB } from "../../services";
import { logger } from "../../utils/logger";
import { normalizeCategory } from "../../utils/categoryNormalizer";
import type { Receipt, ReceiptItem } from "../../types/domain";

const LOCAL_STORAGE_KEY = "@MyMercado:receipts";

// Query keys para cache
export const allReceiptsKeys = {
    all: ["receipts", "all"] as const,
};

/**
 * Aplica normalizeCategory em todos os items[] de todos os receipts.
 * Garante que valores legados (ex: "Laticinios") sejam consolidados
 * para a grafia canonica (ex: "Laticinios").
 */
function normalizeReceipts(receipts: Receipt[]): Receipt[] {
    return receipts.map((receipt) => ({
        ...receipt,
        items: (receipt.items ?? []).map((item: ReceiptItem) => ({
            ...item,
            category: normalizeCategory(item.category),
        })),
    }));
}

/**
 * Hook para buscar TODOS os receipts (para analytics e backup)
 */
/**
 * Persiste receipts no localStorage para fallback offline.
 * Usado por serviços de sincronização, não pelo hook de query.
 */
export function persistReceiptsToLocalStorage(receipts: Receipt[]): void {
    if (Array.isArray(receipts) && receipts.length > 0) {
        try {
            const normalized = normalizeReceipts(receipts);
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(normalized));
        } catch (storageError) {
            logger.error('AllReceiptsQuery', 'Erro ao persistir no localStorage', storageError);
        }
    }
}

export function useAllReceiptsQuery(enabled: boolean = true) {
    return useQuery({
        queryKey: allReceiptsKeys.all,
        queryFn: async () => {
            // Sempre tentar Supabase primeiro se enabled for true
            if (enabled) {
                try {
                    const data = await getAllReceiptsFromDB();
                    const normalized = normalizeReceipts(data);
                    // Persistência deve ser feita por serviço dedicado, não pelo hook
                    return normalized;
                } catch (_error) {
                    // Erro esperado: usuário não autenticado ou Supabase indisponível
                    logger.warn('AllReceiptsQuery', 'Supabase indisponível, usando dados locais');
                }
            }

            // Fallback para localStorage (sempre disponível)
            const localData = localStorage.getItem(LOCAL_STORAGE_KEY);
            if (localData) {
                try {
                    const parsed = JSON.parse(localData) as Receipt[];
                    return normalizeReceipts(parsed);
                } catch (parseError) {
                    logger.error('AllReceiptsQuery', 'Erro ao parsear dados locais', parseError);
                    return [];
                }
            }
            return [];
        },
        staleTime: 5 * 60 * 1000, // 5 minutos
        enabled: true, // Sempre enabled para pelo menos buscar do localStorage
        retry: false, // Não retry se falhar (provavelmente é auth error)
    });
}
