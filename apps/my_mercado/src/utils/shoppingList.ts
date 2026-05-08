import { parseBRL } from "./currency";
import { normalizeKey } from "./normalize";
import type { ShoppingListItem } from "../types/ui";

/**
 * Converte valor para número seguro
 */
export function toNumber(value: string | number | null | undefined, fallback = 0): number {
  const parsed = parseBRL(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Converte valor para texto seguro
 */
export function toText(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  return String(value);
}

/**
 * Sanitiza item da lista de compras
 * Garante que todos os campos obrigatórios estejam presentes e válidos
 */
export function sanitizeListItem(item: unknown): ShoppingListItem | null {
  if (!item || typeof item !== "object") return null;
  const raw = item as Partial<ShoppingListItem>;

  const name = toText(raw.name).trim();
  if (!name) return null;

  const normalizedKey =
    toText(raw.normalized_key).trim() || normalizeKey(name);

  return {
    ...(raw as ShoppingListItem),
    id: toText(raw.id) || `${Date.now()}_${Math.random().toString(16).slice(2)}`,
    name,
    normalized_key: normalizedKey,
    quantity: raw.quantity ? toText(raw.quantity).trim() : undefined,
    checked: Boolean(raw.checked),
    created_at: toText(raw.created_at) || new Date().toISOString(),
    checked_at: raw.checked_at ? toText(raw.checked_at) : undefined,
  };
}

/**
 * Filtra e sanitiza lista de items
 */
export function sanitizeShoppingList(items: unknown[]): ShoppingListItem[] {
  return items
    .map((entry) => sanitizeListItem(entry))
    .filter((entry): entry is ShoppingListItem => Boolean(entry));
}
