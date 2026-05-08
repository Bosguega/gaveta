import { useMutation, useQueryClient } from "@tanstack/react-query";
import { notify } from "../../utils/notifications";
import { deleteReceiptFromDB } from "../../services";
import { logger } from "../../utils/logger";
import type { Receipt } from "../../types/domain";

const LOCAL_STORAGE_KEY = "@MyMercado:receipts";

// Query keys para cache
export const deleteReceiptKeys = {
    all: ["receipts", "delete"] as const,
};

/**
 * Hook para deletar receipt
 */
export function useDeleteReceiptMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id: string) => {
            await deleteReceiptFromDB(id);
            return id;
        },
        onSuccess: (deletedId) => {
            // Atualizar cache otimisticamente
            queryClient.setQueryData(["receipts", "all"], (old: Receipt[] | undefined) => {
                if (!old) return old;
                const newList = old.filter((r: Receipt) => r.id !== deletedId);
                localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newList));
                return newList;
            });

            // Invalidar todas as queries de receipts
            queryClient.invalidateQueries({ queryKey: ["receipts"] });

            notify.deleted();
        },
        onError: (err) => {
            logger.error('DeleteReceipt', 'Erro ao remover nota', err);
            notify.error("Erro ao remover nota no banco remoto.");
        },
    });
}
