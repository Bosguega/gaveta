/**
 * Gerador centralizado de IDs para a aplicação
 * Usa crypto.randomUUID() quando disponível, com fallback para geração manual
 */

let idSequence = 0;

/**
 * Gera um ID único universal
 * @returns string ID único
 */
export function generateId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}_${(idSequence += 1)}_${Math.random().toString(16).slice(2)}`
  );
}

/**
 * Gera um ID scoped por usuário para receipts
 * @param userId - ID do usuário
 * @param rawReceiptId - ID bruto da receipt (opcional)
 * @returns string ID scoped
 */
export function generateUserScopedReceiptId(userId: string, rawReceiptId?: string): string {
  const base = rawReceiptId || generateId();
  return `receipt_${userId}_${base}`;
}

/**
 * Gera um ID para lista de compras
 * @returns string ID de lista
 */
export function generateShoppingListId(): string {
  return `list_${generateId()}`;
}

/**
 * Gera um ID para produto canônico
 * @returns string ID de produto canônico
 */
export function generateCanonicalProductId(): string {
  return `canonical_${generateId()}`;
}

/**
 * Gera um ID para entrada do dicionário
 * @returns string ID de entrada do dicionário
 */
export function generateDictionaryEntryId(): string {
  return `dict_${generateId()}`;
}

/**
 * Gera um código de compartilhamento para listas colaborativas
 * @returns string código de 6 caracteres
 */
export function generateShareCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Sem I, O, 0, 1 para evitar confusão
  let code = "";
  const randomValues = new Uint8Array(6);
  globalThis.crypto?.getRandomValues(randomValues);

  for (let i = 0; i < 6; i++) {
    code += chars[randomValues[i] % chars.length];
  }

  return code;
}
