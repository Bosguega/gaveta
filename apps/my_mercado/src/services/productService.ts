import { getDictionary, updateDictionary, getCanonicalProducts, createCanonicalProduct } from ".";
import { callAI } from "../utils/aiClient";
import { normalizeKey } from "../utils/normalize";
import { stripVariableInfo, cleanAIName } from "../utils/stringUtils";
import { toNumber } from "../utils/shoppingList";
import { logger } from "../utils/logger";
import type { AiNormalizationResult } from "../types/ai";
import type { DictionaryMap, RawReceiptItem, ReceiptItem } from "../types/domain";

const isDev = import.meta.env.DEV;

// ==============================
// Pipeline principal
// ==============================

/**
 * Converte RawReceiptItem (parser output) para ReceiptItem (DB format)
 */
function rawToProcessed(item: RawReceiptItem): ReceiptItem {
  const quantity = toNumber(item.qty, 1);
  const unitPrice = toNumber(item.unitPrice, 0);
  const totalValue = quantity * unitPrice;

  return {
    name: item.name,
    quantity,
    unit: item.unit || "UN",
    price: unitPrice,
    total: totalValue,
  };
}

type ItemWithKey = RawReceiptItem & { normalized_key: string; id?: string };

export async function processItemsPipeline(rawItems: RawReceiptItem[] = []): Promise<ReceiptItem[]> {
  if (!rawItems.length) return [];

  // Carregar produtos VIP existentes para o Auto-Match
  const canonicalProducts = await getCanonicalProducts();

  const itemsWithKey: ItemWithKey[] = rawItems.map((item) => {
    const nameForKey = stripVariableInfo(item.name, item.unit, item.qty);
    const key = normalizeKey(nameForKey);

    if (isDev) {
      logger.debug('ProductPipeline', `Input: "${item.name}" -> Key: "${key}"`);
    }
    return {
      ...item,
      normalized_key: key,
    };
  });

  const keys = [...new Set(itemsWithKey.map((i) => i.normalized_key))];
  const dictionary: DictionaryMap = await getDictionary(keys);

  const unknownMap = new Map<string, string>();

  itemsWithKey.forEach((item) => {
    let dictEntry = dictionary[item.normalized_key];

    if (!dictEntry) {
      const fallbackEntry = Object.values(dictionary).find(
        (entry) => normalizeKey(entry.normalized_name || "") === item.normalized_key,
      );
      if (fallbackEntry) {
        dictEntry = fallbackEntry;
        if (isDev) {
          logger.debug('ProductPipeline', `Fallback match: "${item.name}" -> "${dictEntry.normalized_name}"`);
        }
      }
    }

    if (!dictEntry && !unknownMap.has(item.normalized_key)) {
      const cleanName = stripVariableInfo(item.name, item.unit, item.qty);
      unknownMap.set(item.normalized_key, cleanName);
    }
  });

  const unknownEntries = Array.from(unknownMap.entries()).map(([key, raw]) => ({ key, raw }));

  let aiResults: AiNormalizationResult[] = [];

  for (let i = 0; i < unknownEntries.length; i += 10) {
    const chunk = unknownEntries.slice(i, i + 10);

    try {
      const response = await callAI(chunk);

      const cleaned: AiNormalizationResult[] = response.map((r) => ({
        key: r.key,
        normalized_name: cleanAIName(r.normalized_name),
        category: r.category || "Outros",
        brand: r.brand,
        slug: r.slug,
      }));

      aiResults = [...aiResults, ...cleaned];
    } catch (err) {
      logger.warn('ProductPipeline', 'Erro na IA, usando fallback', err);

      const fallback: AiNormalizationResult[] = chunk.map((item) => ({
        key: item.key,
        normalized_name: item.raw,
        category: "Outros",
      }));

      aiResults = [...aiResults, ...fallback];
    }
  }

  // MODO PREGUIÇOSO ATIVADO: Auto-criar Produtos VIP
  if (aiResults.length) {
    for (const r of aiResults) {
      if (!r.canonical_product_id) {
        // 1. Tentar match por slug ou nome exato
        const match = canonicalProducts.find(
          (cp) =>
            (r.slug && cp.slug === r.slug) ||
            (r.normalized_name && cp.name.toLowerCase() === r.normalized_name.toLowerCase()),
        );

        if (match) {
          r.canonical_product_id = match.id;
        } else if (r.slug && r.normalized_name) {
          // 2. Senão existir, criar automaticamente
          try {
            if (isDev) logger.debug('ProductPipeline', `Criando Produto VIP: ${r.normalized_name}`);
            const newCp = await createCanonicalProduct({
              slug: r.slug,
              name: r.normalized_name,
              category: r.category,
              brand: r.brand || "Outros",
            });
            r.canonical_product_id = newCp.id;
            // Adicionar à lista local para não criar duplicados na mesma nota
            canonicalProducts.push(newCp);
          } catch (err) {
            logger.error('ProductPipeline', 'Erro ao criar produto VIP automático', err);
          }
        }
      }
    }
    await updateDictionary(aiResults);
  }

  const aiMap = aiResults.reduce((acc, r) => {
    acc[r.key] = r;
    return acc;
  }, {} as Record<string, AiNormalizationResult>);

  const finalItems: ReceiptItem[] = itemsWithKey.map((item) => {
    const dictEntry = dictionary[item.normalized_key] || aiMap[item.normalized_key];

    const { quantity, price, total } = rawToProcessed(item);

    return {
      id: item.id,
      name: item.name,
      normalized_key: item.normalized_key,
      normalized_name: dictEntry?.normalized_name || item.name,
      category: dictEntry?.category || "Outros",
      canonical_product_id: dictEntry?.canonical_product_id,
      quantity,
      unit: item.unit || "UN",
      price,
      total,
    };
  });

  return finalItems;
}
