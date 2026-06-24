import { validateNfceSpUrl } from "./nfce/validateUrl";
import { fetchNfceHtml } from "./nfce/fetcher";
import {
  extractEstablishment,
  extractDateFromHtml,
  parseItemsFromHtml,
  extractTotalDiscount,
  generateReceiptId,
} from "./nfce/htmlParser";
import type { Receipt } from "../types/domain";
import { parseRawTextReceipt } from "./nfce/textParser";
import { logger } from "../utils/logger";

export { parseRawTextReceipt };

export async function parseNFCeSP(url: string): Promise<Receipt> {
  if (import.meta.env.DEV) {
    logger.info("Parser", "parseNFCeSP chamado com URL:", url);
  }
  const targetUrl = validateNfceSpUrl(url);
  const html = await fetchNfceHtml(targetUrl);

  if (import.meta.env.DEV) {
    logger.info("Parser", "HTML obtido com sucesso, parseando...");
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    const establishment = extractEstablishment(doc);
    const date = extractDateFromHtml(doc);
    const items = parseItemsFromHtml(doc);
    const totalDiscount = extractTotalDiscount(doc);
    const receiptId = await generateReceiptId(establishment, date, items, targetUrl);

    const parsedItems = items.map((rawItem) => ({
      name: rawItem.name,
      quantity: parseFloat(rawItem.qty.replace(",", ".")) || 1,
      unit: rawItem.unit,
      price: parseFloat(rawItem.unitPrice.replace(",", ".")) || 0,
      paid_price: parseFloat(rawItem.unitPrice.replace(",", ".")) || 0,
      total: parseFloat(rawItem.total.replace(",", ".")) || 0,
    }));

    return {
      id: receiptId,
      establishment,
      date,
      items: parsedItems,
      total_discount: totalDiscount,
    };
  } catch (error) {
    logger.error("Parser", "Erro ao parsear NFC-e:", error);
    throw error;
  }
}