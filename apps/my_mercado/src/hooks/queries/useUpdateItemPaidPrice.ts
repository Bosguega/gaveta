import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getAuthenticatedSupabaseContext } from "../../services/authService";
import { logger } from "../../utils/logger";
import { mapSupabaseError } from "../../utils/supabaseError";
import { notify } from "../../utils/notifications";

/**
 * Hook para atualizar o paid_price de um item individualmente
 */
export function useUpdateItemPaidPrice() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            itemId,
            paidPrice,
        }: {
            itemId: string;
            paidPrice: number;
        }) => {
            const { client } = await getAuthenticatedSupabaseContext();

            const { error } = await client.rpc("update_item_paid_price", {
                p_item_id: itemId,
                p_paid_price: paidPrice,
            });

            if (error) {
                logger.error("UpdateItemPaidPrice", "Erro ao atualizar paid_price", error as unknown);
                throw mapSupabaseError(error, "updateItemPaidPrice");
            }
        },
        onSuccess: () => {
            // Invalidar queries de receipts para atualizar o cache
            queryClient.invalidateQueries({ queryKey: ["receipts"] });
        },
        onError: (err) => {
            logger.error("UpdateItemPaidPrice", "Erro ao atualizar preço pago", err);
            notify.error("Erro ao atualizar preço do item.");
        },
    });
}