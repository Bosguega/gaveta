import {
  createReceiptsStorage,
  createDictionaryStorage,
  isIndexedDBAvailable,
  getStorageStatus,
} from "../utils/storage";
import { logger } from "../utils/logger";
import { ErrorCodes } from "../utils/errorCodes";
import { getAllReceiptsFromDB, saveReceiptToDB } from "./receiptService";
import { getDictionary } from "./dictionaryService";
import type { Receipt, ReceiptItem, DictionaryEntry } from "../types/domain";

// =========================
// RESULT TYPES
// =========================

/**
 * Resultado de operações de save com fallback
 */
export type SaveWithFallbackResult =
  | { status: "supabase"; data: { id: string; date: string } }
  | { status: "fallback"; data: { id: string; date: string } }
  | { status: "error"; error: Error };

/**
 * Resultado de operações de get com fallback
 */
export type GetWithFallbackResult<T> =
  | { status: "supabase"; data: T[] }
  | { status: "fallback"; data: T[] }
  | { status: "error"; error: Error };

// =========================
// RECEIPT FALLBACK
// =========================

/**
 * Wrapper com fallback automático para getAllReceiptsFromDB
 * Tenta Supabase, fallback para IndexedDB/localStorage
 * Retorna resultado estruturado sem efeitos colaterais (sem toast)
 */
export async function getAllReceiptsFromDBWithFallback(): Promise<GetWithFallbackResult<Receipt>> {
  try {
    // Tenta Supabase primeiro
    const receipts = await getAllReceiptsFromDB();
    return { status: "supabase", data: receipts };
  } catch (error) {
    logger.warn("getAllReceiptsFromDBWithFallback", "Supabase falhou, usando fallback local", error, ErrorCodes.STORAGE_SUPABASE_FAILED);

    try {
      const receiptsStorage = createReceiptsStorage();
      const receipts = await receiptsStorage.getAll<Receipt>();

      if (receipts.length > 0) {
        logger.info("getAllReceiptsFromDBWithFallback", `${receipts.length} receipts carregados do storage local`);
      }

      return { status: "fallback", data: receipts };
    } catch (fallbackError) {
      logger.error("getAllReceiptsFromDBWithFallback", "Fallback também falhou", fallbackError, ErrorCodes.STORAGE_FALLBACK_FAILED);
      return { status: "error", error: fallbackError instanceof Error ? fallbackError : new Error("Falha ao carregar dados") };
    }
  }
}

/**
 * Wrapper com fallback automático para saveReceiptToDB
 * Salva no Supabase e faz backup no storage local
 * Retorna resultado estruturado sem efeitos colaterais (sem toast)
 */
export async function saveReceiptToDBWithFallback(
  receiptData: Receipt,
  items: ReceiptItem[]
): Promise<SaveWithFallbackResult> {
  let supabaseError: unknown = null;

  // Tenta salvar no Supabase
  try {
    const result = await saveReceiptToDB(receiptData, items);
    return { status: "supabase", data: result };
  } catch (error) {
    supabaseError = error;
    logger.warn("saveReceiptToDBWithFallback", "Supabase falhou ao salvar, usando fallback local", error, ErrorCodes.STORAGE_SUPABASE_FAILED);
  }

  // Sempre salva no storage local como backup
  try {
    const receiptsStorage = createReceiptsStorage();
    await receiptsStorage.set(receiptData.id, { ...receiptData, items });

    return { status: "fallback", data: { id: receiptData.id, date: receiptData.date } };
  } catch (fallbackError) {
    logger.error("saveReceiptToDBWithFallback", "Fallback local falhou", fallbackError, ErrorCodes.STORAGE_FALLBACK_FAILED);

    if (supabaseError) {
      return {
        status: "error",
        error: supabaseError instanceof Error
          ? supabaseError
          : new Error("Falha ao salvar no Supabase e no fallback local")
      };
    }

    // Se chegou aqui, fallback falhou mas supabase funcionou (caso raro)
    return { status: "supabase", data: { id: receiptData.id, date: receiptData.date } };
  }
}

// =========================
// DICTIONARY FALLBACK
// =========================

/**
 * Wrapper com fallback para getDictionary
 * Retorna resultado estruturado sem efeitos colaterais
 */
export async function getDictionaryWithFallback(
  keys: string[]
): Promise<GetWithFallbackResult<DictionaryEntry>> {
  try {
    // Tenta Supabase primeiro
    const result = await getDictionary(keys);
    // Converte Map para array de entries, garantindo que normalized_name seja sempre string
    const entries: DictionaryEntry[] = Object.entries(result)
      .filter(([_, value]) => value.normalized_name !== undefined)
      .map(([key, value]) => ({
        key,
        normalized_name: value.normalized_name!,
        category: value.category,
        canonical_product_id: value.canonical_product_id,
      }));
    return { status: "supabase", data: entries };
  } catch (error) {
    logger.warn("getDictionaryWithFallback", "Supabase falhou, usando fallback local", error, ErrorCodes.STORAGE_SUPABASE_FAILED);

    try {
      const dictStorage = createDictionaryStorage();
      const allEntries = await dictStorage.getAll<DictionaryEntry>();

      // Filtra apenas as chaves solicitadas
      const filteredEntries = allEntries.filter((entry) => keys.includes(entry.key));

      return { status: "fallback", data: filteredEntries };
    } catch (fallbackError) {
      logger.error("getDictionaryWithFallback", "Fallback também falhou", fallbackError, ErrorCodes.STORAGE_FALLBACK_FAILED);
      return { status: "error", error: fallbackError instanceof Error ? fallbackError : new Error("Falha ao carregar dicionário") };
    }
  }
}

// =========================
// STORAGE STATUS
// =========================

/**
 * Verifica status do storage e conexão
 */
export async function getStorageConnectionStatus(): Promise<{
  supabase: boolean;
  indexedDB: boolean;
  localStorage: boolean;
  storageUsed: "indexeddb" | "localStorage" | "none";
  totalLocalItems: number;
}> {
  const { isSupabaseConfigured } = await import("./supabaseClient");

  const indexedDB = isIndexedDBAvailable();
  const storageStatus = await getStorageStatus();

  return {
    supabase: isSupabaseConfigured,
    indexedDB,
    localStorage:
      typeof window !== "undefined" && !!window.localStorage,
    storageUsed: storageStatus.storageUsed,
    totalLocalItems: storageStatus.totalItems,
  };
}
