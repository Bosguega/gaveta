import { useMutation, useQueryClient } from "@tanstack/react-query";
import { notify } from "../../utils/notifications";
import { restoreReceiptsToDB } from "../../services";
import { logger } from "../../utils/logger";
import type { Receipt } from "../../types/domain";

const LOCAL_STORAGE_KEY = "@MyMercado:receipts";

// Query keys para cache
export const restoreReceiptsKeys = {
    all: ["receipts", "restore"] as const,
};

/**
 * Hook para restaurar backup de receipts
 */
export function useRestoreReceiptsMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (receipts: Receipt[]) => {
            await restoreReceiptsToDB(receipts);
            return receipts;
        },
        onSuccess: (restoredReceipts) => {
            // Atualizar cache
            queryClient.setQueryData(["receipts", "all"], restoredReceipts);
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(restoredReceipts));

            // Invalidar todas as queries de receipts
            queryClient.invalidateQueries({ queryKey: ["receipts"] });

            notify.success(`Backup restaurado com ${restoredReceipts.length} notas!`);
        },
        onError: (err) => {
            logger.error('RestoreReceipts', 'Erro ao restaurar backup', err);
            notify.error("Erro ao restaurar backup.");
        },
    });
}
