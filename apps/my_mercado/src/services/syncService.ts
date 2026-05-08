import { logger } from "../utils/logger";
import { createReceiptsStorage } from "../utils/storage";
import { saveReceiptToDB } from "./receiptService";
import type { Receipt } from "../types/domain";

/**
 * Sincroniza storage local com Supabase quando online
 * Deve ser chamado quando o usuário recuperar conexão
 */
export async function syncLocalStorageWithSupabase(): Promise<{
  synced: number;
  errors: number;
}> {
  let synced = 0;
  let errors = 0;

  try {
    const receiptsStorage = createReceiptsStorage();
    const localReceipts = await receiptsStorage.getAll<Receipt>();

    for (const receipt of localReceipts) {
      try {
        // Verifica se já existe no Supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const items = (receipt as any).items || [];
        await saveReceiptToDB(receipt, items);
        synced++;
      } catch (error) {
        logger.error(
          'Sync',
          `Erro ao sincronizar receipt ${receipt.id}:`,
          error
        );
        errors++;
      }
    }

    if (synced > 0) {
      logger.info(
        'Sync',
        `Sincronização concluída: ${synced} itens, ${errors} erros`
      );
    }
  } catch (error) {
    logger.error('Sync', 'Erro ao sincronizar storage local:', error);
    errors++;
  }

  return { synced, errors };
}
