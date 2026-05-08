import { useMutation, useQueryClient } from "@tanstack/react-query";
import { notify } from "../../utils/notifications";
import {
    saveReceiptToDB,
    deleteReceiptFromDB
} from "../../services";
import { processItemsPipeline } from "../../services/productService";
import { getReceiptIdCandidates, toUserScopedReceiptId } from "../../utils/receiptId";
import { logger } from "../../utils/logger";
import { canonicalProductKeys } from "./useCanonicalProductsQuery";
import type { Receipt } from "../../types/domain";

const LOCAL_STORAGE_KEY = "@MyMercado:receipts";

// Query keys para cache
export const saveReceiptKeys = {
    all: ["receipts", "save"] as const,
};

/**
 * Hook para salvar receipt com detecção de duplicatas
 */
export function useSaveReceiptMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            receipt,
            sessionUserId,
            forceReplace = false
        }: {
            receipt: Receipt;
            sessionUserId: string | null;
            forceReplace?: boolean;
        }) => {
            logger.debug('SaveReceipt', 'Iniciando salvamento...', { sessionUserId, receiptId: receipt.id });

            // Buscar receipts atuais do cache ou localStorage
            const currentReceipts = queryClient.getQueryData<Receipt[]>(["receipts", "all"]) ||
                JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || "[]") as Receipt[];

            const rawReceiptId = receipt.id || Date.now().toString();
            const receiptId = toUserScopedReceiptId(rawReceiptId, sessionUserId ?? undefined);

            logger.debug('SaveReceipt', 'ReceiptId gerado:', receiptId);

            const idCandidates = new Set(
                getReceiptIdCandidates(rawReceiptId, sessionUserId ?? undefined),
            );
            const existing = currentReceipts.find((r: Receipt) => idCandidates.has(String(r.id)));

            if (existing && !forceReplace) {
                logger.info('SaveReceipt', 'Nota duplicada detectada');
                return { duplicate: true, existingReceipt: existing };
            }

            // Se existe e forceReplace, deletar o antigo primeiro
            if (existing && forceReplace && existing.id !== receiptId) {
                logger.info('SaveReceipt', 'Deletando nota antiga para substituir');
                await deleteReceiptFromDB(existing.id);
            }

            // Processar items
            logger.debug('SaveReceipt', 'Processando items...');
            // Converter ReceiptItem para RawReceiptItem para o pipeline
            const rawItems = (receipt.items || []).map((item) => ({
              name: item.name,
              qty: item.quantity.toString().replace('.', ','),
              unit: item.unit || 'UN',
              unitPrice: item.price.toString().replace('.', ','),
              total: (item.total ?? item.price * item.quantity).toString().replace('.', ','),
            }));
            const processedItems = await processItemsPipeline(rawItems);
            const fullReceipt = { ...receipt, id: receiptId, items: processedItems };

            // Salvar no banco
            logger.debug('SaveReceipt', 'Salvando no DB...');
            const persistedReceipt = await saveReceiptToDB(fullReceipt, processedItems);

            logger.info('SaveReceipt', 'Salvo com sucesso!', persistedReceipt);

            const receiptForUi: Receipt = {
                ...fullReceipt,
                date: persistedReceipt?.date || fullReceipt.date,
            };

            return { success: true, receipt: receiptForUi, existingId: existing?.id };
        },
        onSuccess: (result) => {
            if ('duplicate' in result && result.duplicate) {
                // Não invalidar cache se for duplicata
                return;
            }

            if ('success' in result && result.success) {
                // Atualizar cache otimisticamente
                queryClient.setQueryData(["receipts", "all"], (old: Receipt[] | undefined) => {
                    if (!old) return [result.receipt];

                    const idsToReplace = new Set<string>();
                    if (result.existingId) idsToReplace.add(String(result.existingId));

                    const filtered = old.filter((r: Receipt) => !idsToReplace.has(String(r.id)));
                    const newList = [result.receipt, ...filtered];
                    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newList));
                    return newList;
                });

                // Invalidar queries relacionadas
                queryClient.invalidateQueries({ queryKey: ["receipts"] });
                // Invalidar cache de produtos canônicos (caso tenham sido auto-criados)
                queryClient.invalidateQueries({ queryKey: canonicalProductKeys.all });
            }
        },
        onError: (err) => {
            logger.error('SaveReceipt', 'Erro ao salvar nota', err);
            notify.error("Erro técnico ao salvar a nota.");
        },
    });
}
