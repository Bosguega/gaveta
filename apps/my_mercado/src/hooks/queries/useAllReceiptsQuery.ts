import { useQuery } from "@tanstack/react-query";
import { getAllReceiptsFromDB } from "../../services";
import { logger } from "../../utils/logger";
import type { Receipt } from "../../types/domain";

const LOCAL_STORAGE_KEY = "@MyMercado:receipts";

// Query keys para cache
export const allReceiptsKeys = {
    all: ["receipts", "all"] as const,
};

/**
 * Hook para buscar TODOS os receipts (para analytics e backup)
 */
export function useAllReceiptsQuery(enabled: boolean = true) {
    return useQuery({
        queryKey: allReceiptsKeys.all,
        queryFn: async () => {
            // Sempre tentar Supabase primeiro se enabled for true
            if (enabled) {
                try {
                    const data = await getAllReceiptsFromDB();
                    // Sincronizar com localStorage como fallback
                    if (Array.isArray(data) && data.length > 0) {
                        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
                    }
                    return data;
                } catch (_error) {
                    // Erro esperado: usuário não autenticado ou Supabase indisponível
                    logger.warn('AllReceiptsQuery', 'Supabase indisponível, usando dados locais');
                }
            }

            // Fallback para localStorage (sempre disponível)
            const localData = localStorage.getItem(LOCAL_STORAGE_KEY);
            if (localData) {
                try {
                    return JSON.parse(localData) as Receipt[];
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
