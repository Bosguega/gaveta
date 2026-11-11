import { formatToISO } from "../utils/date";
import { toUserScopedReceiptId } from "../utils/receiptId";
import { getAuthenticatedSupabaseContext } from "./authService";
import { logger } from "../utils/logger";
import { mapSupabaseError } from "../utils/supabaseError";
import type { Receipt, ReceiptItem } from "../types/domain";

interface ReplacedReceiptRow {
  id: string;
  establishment?: string | null;
  date: string;
  created_at?: string | null;
}

/**
 * Substitui uma nota existente por outra em uma única transação no Supabase.
 * A função SQL salva a nova nota e remove a antiga; qualquer falha reverte tudo.
 */
export async function replaceReceiptToDB(
  receiptData: Receipt,
  items: ReceiptItem[],
  oldReceiptId: string,
): Promise<ReplacedReceiptRow> {
  const { client, user } = await getAuthenticatedSupabaseContext();
  const scopedReceiptId = toUserScopedReceiptId(receiptData.id, user.id);
  const scopedOldReceiptId = toUserScopedReceiptId(oldReceiptId, user.id);
  const isoDate = formatToISO(receiptData.date);

  const { data, error } = await client.rpc("replace_receipt_atomic", {
    p_user_id: user.id,
    p_old_receipt_id: scopedOldReceiptId,
    p_receipt_id: scopedReceiptId,
    p_establishment: receiptData.establishment,
    p_date: isoDate,
    p_items: (items || []).map((item) => ({
      receipt_id: scopedReceiptId,
      name: item.name,
      normalized_key: item.normalized_key,
      normalized_name: item.normalized_name,
      category: item.category,
      quantity: item.quantity,
      unit: item.unit || "un",
      price: item.price,
      paid_price: item.paid_price,
      total: item.total,
    })),
    p_total_discount: receiptData.total_discount ?? null,
    p_nfce_qr_url: receiptData.nfce_qr_url ?? null,
  });

  if (error) {
    logger.error("ReceiptService", "Erro ao substituir nota", error as unknown);
    throw mapSupabaseError(error, "replaceReceiptToDB");
  }

  const receipt = data as ReplacedReceiptRow;
  return {
    id: receipt.id,
    establishment: receipt.establishment,
    date: receipt.date,
    created_at: receipt.created_at,
  };
}
