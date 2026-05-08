import { toStoreSlug } from './stringUtils';
import { normalizeManualDate } from './date';

const USER_SCOPE_SEPARATOR = '__u_';

function normalizeReceiptId(rawId: string | number | null | undefined): string {
  const value = `${rawId ?? ''}`.trim();
  return value || Date.now().toString();
}

export function toUserScopedReceiptId(
  rawId: string | number | null | undefined,
  userId: string | null | undefined,
): string {
  const baseId = normalizeReceiptId(rawId);
  if (!userId) return baseId;

  const suffix = `${USER_SCOPE_SEPARATOR}${userId}`;
  if (baseId.endsWith(suffix)) return baseId;
  return `${baseId}${suffix}`;
}

export function getReceiptIdCandidates(
  rawId: string | number | null | undefined,
  userId: string | null | undefined,
): string[] {
  const baseId = normalizeReceiptId(rawId);
  const scopedId = toUserScopedReceiptId(baseId, userId);
  return [...new Set([scopedId, baseId])];
}

/**
 * Gera um ID único para receipt manual
 */
export function generateManualReceiptId(establishment: string, dateStr: string): string {
  const randomSuffix = (globalThis.crypto?.randomUUID?.() ||
    `${Date.now()}_${Math.random().toString(16).slice(2)}`).replace(/-/g, '').slice(0, 12);

  return `manual_${normalizeManualDate(dateStr)}_${toStoreSlug(establishment)}_${randomSuffix}`;
}
