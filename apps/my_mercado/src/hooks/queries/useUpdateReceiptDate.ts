import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateReceiptDateInDB } from "../../services/receiptService";
import { logger } from "../../utils/logger";
import { notify } from "../../utils/notifications";

/** Atualiza somente a data de compra de uma nota já salva. */
export function useUpdateReceiptDate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      receiptId,
      date,
    }: {
      receiptId: string;
      date: string;
    }) => {
      await updateReceiptDateInDB(receiptId, date);
    },
    onSuccess: () => {
      // Atualiza histórico, ordenação, filtros e o cache usado pelo fallback local.
      queryClient.invalidateQueries({ queryKey: ["receipts"] });
    },
    onError: (error) => {
      logger.error("UpdateReceiptDate", "Erro ao atualizar data da nota", error);
      notify.error("Erro ao atualizar a data da nota.");
    },
  });
}
