import { formatToISO, formatToBR } from "../utils/date";
import { calc } from "../utils/currency";
import { getPeriodDateRange } from "../utils/filters";
import { toUserScopedReceiptId } from "../utils/receiptId";
import { getAuthenticatedSupabaseContext } from "./authService";
import { logger } from "../utils/logger";
import { mapSupabaseError } from "../utils/supabaseError";
import type { Receipt, ReceiptItem } from "../types/domain";

interface DbItemRow {
  id?: string;
  name: string;
  normalized_key?: string | null;
  normalized_name?: string | null;
  category?: string | null;
  quantity?: number | null;
  unit?: string | null;
  price?: number | null;
}

interface DbReceiptRow {
  id: string;
  establishment: string;
  establishment_display?: string | null;
  date: string;
  created_at?: string | null;
  items?: DbItemRow[] | null;
}

interface SavedReceiptRow {
  id: string;
  establishment?: string | null;
  date: string;
  created_at?: string | null;
}

const RESTORE_BATCH_SIZE = 25;

/**
 * Mapeia um item do banco de dados para o formato ReceiptItem
 */
function mapDbItemToReceiptItem(item: DbItemRow): ReceiptItem {
  const quantity = item.quantity ?? 1;
  const price = item.price ?? 0;
  const total = calc.mul(price, quantity);

  return {
    id: item.id,
    name: item.name,
    normalized_key: item.normalized_key ?? undefined,
    normalized_name: item.normalized_name ?? undefined,
    category: item.category ?? undefined,
    quantity,
    unit: item.unit ?? undefined,
    price,
    total,
  };
}

/**
 * Mapeia ReceiptItem para o formato de inserção no banco
 */
function mapReceiptItemToDb(item: ReceiptItem, receiptId: string) {
  return {
    receipt_id: receiptId,
    name: item.name,
    normalized_key: item.normalized_key,
    normalized_name: item.normalized_name,
    category: item.category,
    quantity: item.quantity,
    unit: item.unit || "un",
    price: item.price,
  };
}

async function saveReceiptAtomic(
  receiptData: Receipt,
  items: ReceiptItem[],
): Promise<SavedReceiptRow> {
  const { client, user } = await getAuthenticatedSupabaseContext();
  const scopedReceiptId = toUserScopedReceiptId(receiptData.id, user.id);
  const isoDate = formatToISO(receiptData.date);

  const { data, error } = await client.rpc("save_receipt_atomic", {
    p_user_id: user.id,
    p_receipt_id: scopedReceiptId,
    p_establishment: receiptData.establishment,
    p_date: isoDate,
    p_items: items.map((item: ReceiptItem) =>
      mapReceiptItemToDb(item, scopedReceiptId)
    ),
  });

  if (error) {
    logger.error('ReceiptService', 'Erro ao salvar nota', error as unknown);
    throw mapSupabaseError(error, "saveReceiptAtomic");
  }

  return data as SavedReceiptRow;
}

/**
 * Mapeia uma linha do banco para o formato Receipt
 */
function mapDbReceiptToReceipt(row: DbReceiptRow): Receipt {
  return {
    id: row.id,
    establishment: row.establishment,
    establishment_display: row.establishment_display ?? undefined,
    date: formatToBR(row.date),
    items: (row.items || []).map(mapDbItemToReceiptItem),
  };
}

// =========================
// RECEIPT CRUD
// =========================

export interface GetReceiptsFilters {
  search?: string;
  period?: string;
  startDate?: string;
  endDate?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface GetReceiptsResult {
  data: Receipt[];
  hasMore: boolean;
  total: number;
}

export interface GetReceiptsOptions {
  includeItems?: boolean;
}

/**
 * Busca recibos com paginação e filtros
 */
export async function getReceiptsPaginated(
  page: number = 1,
  pageSize: number = 20,
  filters?: GetReceiptsFilters,
  options: GetReceiptsOptions = {},
): Promise<GetReceiptsResult> {
  const { client } = await getAuthenticatedSupabaseContext();

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const includeItems = options.includeItems || Boolean(filters?.search);
  const selectColumns: string = includeItems
    ? `
      id,
      establishment,
      establishment_display,
      date,
      created_at,
      items (
        id,
        name,
        normalized_key,
        normalized_name,
        category,
        quantity,
        unit,
        price
      )
    `
    : "id, establishment, establishment_display, date, created_at";

  let query = client
    .from("receipts")
    .select(selectColumns, { count: "exact" });

  // Aplicar filtro de busca
  if (filters?.search) {
    const searchTerm = `%${filters.search}%`;
    query = query.or(`establishment.ilike.${searchTerm},items.name.ilike.${searchTerm}`);
  }

  // Aplicar filtro de período
  if (filters?.period && filters.period !== "all") {
    const range = getPeriodDateRange(filters.period, filters.startDate, filters.endDate);
    if (range) {
      const startIso = formatToISO(range.start);
      const endIso = formatToISO(range.end);
      if (startIso) query = query.gte("date", startIso);
      if (endIso) query = query.lte("date", endIso);
    }
  }

  // Aplicar ordenação
  const sortBy = filters?.sortBy || "date";
  const sortOrder = filters?.sortOrder || "desc";

  if (sortBy === "date") {
    query = query.order("date", { ascending: sortOrder === "asc" });
  } else if (sortBy === "store") {
    query = query.order("establishment", { ascending: sortOrder === "asc" });
  } else {
    query = query.order("created_at", { ascending: sortOrder === "asc" });
  }

  query = query.range(from, to);

  const { data, error, count } = await query;

  if (error) {
    logger.error('ReceiptService', 'Erro ao buscar notas', error as unknown);
    throw error;
  }

  const rows = (data || []) as unknown as DbReceiptRow[];
  const receipts = rows.map(mapDbReceiptToReceipt);

  return {
    data: receipts,
    hasMore: to < (count || 0),
    total: count || 0,
  };
}

/**
 * Busca todos os recibos (mantido para compatibilidade)
 */
export async function getAllReceiptsFromDB(): Promise<Receipt[]> {
  try {
    const result = await getReceiptsPaginated(1, 2000, undefined, {
      includeItems: true,
    });
    return result.data;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    if (import.meta.env.DEV) {
      logger.error('getAllReceiptsFromDB', 'Erro ao buscar todos os receipts', error);
    }

    // Se for erro de autenticação, lança erro específico
    if (error?.code === 'PGRST205') {
      logger.warn('getAllReceiptsFromDB', 'Tabela não encontrada ou RLS bloqueou. Verifique: 1) Usuário logado, 2) Tabelas existem, 3) RLS policies configuradas');
      throw new Error('Erro de autenticação ou tabela não existe');
    }

    if (error?.message?.includes('autenticado')) {
      throw new Error('Usuário não autenticado');
    }

    // Outros erros, relança
    throw error;
  }
}

/**
 * Busca os itens de um recibo sob demanda.
 */
export async function getReceiptItemsFromDB(receiptId: string): Promise<ReceiptItem[]> {
  const { client, user } = await getAuthenticatedSupabaseContext();

  const { data: receipt, error: receiptError } = await client
    .from("receipts")
    .select("id")
    .eq("id", receiptId)
    .eq("user_id", user.id)
    .single();

  if (receiptError) throw receiptError;
  if (!receipt) return [];

  const { data, error } = await client
    .from("items")
    .select(
      `
      id,
      name,
      normalized_key,
      normalized_name,
      category,
      quantity,
      unit,
      price
    `,
    )
    .eq("receipt_id", receiptId);

  if (error) throw error;

  return ((data || []) as DbItemRow[]).map(mapDbItemToReceiptItem);
}

/**
 * Restaura múltiplos recibos no banco
 */
export async function restoreReceiptsToDB(receipts: Receipt[]): Promise<boolean> {
  for (let index = 0; index < receipts.length; index += RESTORE_BATCH_SIZE) {
    const batch = receipts.slice(index, index + RESTORE_BATCH_SIZE);
    await Promise.all(
      batch.map((receiptData) =>
        saveReceiptAtomic(receiptData, receiptData.items || [])
      ),
    );
  }
  return true;
}

/**
 * Salva ou atualiza um recibo no banco
 */
export async function saveReceiptToDB(
  receiptData: Receipt,
  items: ReceiptItem[]
) {
  const receipt = await saveReceiptAtomic(receiptData, items || []);

  // Retornar receipt com data em formato BR para consistência
  return {
    id: receipt.id,
    establishment: receipt.establishment,
    date: formatToBR(receipt.date),
    created_at: receipt.created_at,
  };
}

/**
 * Deleta um recibo do banco
 */
export async function deleteReceiptFromDB(id: string): Promise<boolean> {
  const { client } = await getAuthenticatedSupabaseContext();
  const { error } = await client.from("receipts").delete().eq("id", id);

  if (error) throw error;
  return true;
}

/**
 * Limpa todos os recibos do usuário
 */
export async function clearReceiptsAndItemsFromDB(): Promise<boolean> {
  const { client, user } = await getAuthenticatedSupabaseContext();
  const { error } = await client.from("receipts").delete().eq("user_id", user.id);
  if (error) throw error;
  return true;
}
