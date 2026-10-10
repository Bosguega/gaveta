import { useMutation, useQueryClient } from "@tanstack/react-query";
import { notify } from "../../utils/notifications";
import {
    saveReceiptToDB,
    deleteReceiptFromDB
} from "../../services";

import { getReceiptIdCandidates, toUserScopedReceiptId, findContentMatch } from "../../utils/receiptId";
import { logger } from "../../utils/logger";
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

            // Cruzamento entre fontes (apenas para novas notas da galeria).
            // Serve tanto para sinalizar duplicata (quando !forceReplace) quanto
            // para saber qual nota substituir (quando forceReplace), pois as
            // fontes diferentes usam IDs distintos e o match por ID não basta.
            // Não altera o comportamento de QR/texto/manual.
            let crossSourceExisting: Receipt | undefined;
            if (!existing && receipt.source === "gallery") {
                const contentMatch = findContentMatch(receipt, currentReceipts);
                if (contentMatch) {
                    crossSourceExisting = contentMatch.receipt;
                    if (!forceReplace) {
                        logger.info('SaveReceipt', 'Nota da galeria corresponde a nota existente de outra fonte', {
                            level: contentMatch.level,
                            existingId: contentMatch.receipt.id,
                        });
                        // Deixa o DuplicateModal decidir — nunca sobrescreve sozinho.
                        return {
                            duplicate: true,
                            existingReceipt: contentMatch.receipt,
                            contentMatchLevel: contentMatch.level,
                        };
                    }
                }
            }

            if (existing && !forceReplace) {
                logger.info('SaveReceipt', 'Nota duplicada detectada');
                return { duplicate: true, existingReceipt: existing };
            }

            // forceReplace: remover a nota antiga (por ID ou por conteúdo) antes
            // de salvar a nova, para não deixar duplicata no histórico.
            if (forceReplace) {
                const toReplace = existing ?? crossSourceExisting;
                if (toReplace && toReplace.id !== receiptId) {
                    logger.info('SaveReceipt', 'Deletando nota antiga para substituir', toReplace.id);
                    await deleteReceiptFromDB(toReplace.id);
                }
            }

            // Os itens já vêm processados do useQRCodeProcessor
            const processedItems = receipt.items;
            const fullReceipt = { ...receipt, id: receiptId };

            // Salvar no banco
            logger.debug('SaveReceipt', 'Salvando no DB...');
            const persistedReceipt = await saveReceiptToDB(fullReceipt, processedItems);

            logger.info('SaveReceipt', 'Salvo com sucesso!', persistedReceipt);

            const receiptForUi: Receipt = {
                ...fullReceipt,
                date: persistedReceipt?.date || fullReceipt.date,
            };

            // existingId cobre match por ID; replacedId cobre cruzamento entre
            // fontes — ambos são removidos do cache otimista abaixo.
            return {
                success: true,
                receipt: receiptForUi,
                existingId: existing?.id,
                replacedId: crossSourceExisting?.id,
            };
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
                    if (result.replacedId) idsToReplace.add(String(result.replacedId));

                    const filtered = old.filter((r: Receipt) => !idsToReplace.has(String(r.id)));
                    const newList = [result.receipt, ...filtered];
                    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newList));
                    return newList;
                });

                queryClient.invalidateQueries({ queryKey: ["receipts"] });
            }
        },
        onError: (err) => {
            logger.error('SaveReceipt', 'Erro ao salvar nota', err);
            notify.error("Erro técnico ao salvar a nota.");
        },
    });
}
