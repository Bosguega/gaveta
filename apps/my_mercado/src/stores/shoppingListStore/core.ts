import { generateId } from "../../utils/idGenerator";
import { toTitleCase } from "../../utils/stringUtils";
import type { ShoppingListItem, ShoppingListMeta } from "../../types/ui";
import type { UserShoppingLists } from "./types";

const FALLBACK_OWNER_KEY = "__local__";

/**
 * Gera nome automático para lista baseado na data atual.
 * Ex: "Compras 14/05" ou "Compras 14/05/2026"
 */
export function getDefaultListName(): string {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `Compras ${day}/${month}`;
}

const defaultUserDataByOwner = new Map<string, UserShoppingLists>();

export function getOwnerKey(userId: string | null | undefined): string {
  const trimmed = (userId || "").trim();
  return trimmed || FALLBACK_OWNER_KEY;
}

export function createListMeta(name?: string): ShoppingListMeta {
  const now = new Date().toISOString();
  const listName = (name || getDefaultListName()).trim();
  return {
    id: generateId(),
    name: listName,
    created_at: now,
    updated_at: now,
  };
}

export function createListItem(
  name: string,
  quantity?: string,
  note?: string,
  normalizedName?: string,
): ShoppingListItem {
  const now = new Date().toISOString();
  return {
    id: generateId(),
    name: name.trim(),
    normalized_name: normalizedName || toTitleCase(name).replace(/\s+/g, " ").trim(),
    quantity: quantity?.trim() || undefined,
    note: note?.trim().slice(0, 200) || undefined,
    checked: false,
    created_at: now,
  };
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function coerceItem(raw: unknown): ShoppingListItem | null {
  if (!isRecord(raw)) return null;
  const name = String(raw.name || "").trim();
  if (!name) return null;

  const id = String(raw.id || "").trim() || generateId();
  const normalized_name = String(raw.normalized_name || "").trim() || toTitleCase(name).replace(/\s+/g, " ").trim();

  return {
    id,
    name,
    normalized_name,
    quantity: raw.quantity ? String(raw.quantity).trim() : undefined,
    note: raw.note ? String(raw.note).trim().slice(0, 200) : undefined,
    checked: Boolean(raw.checked),
    created_at: raw.created_at ? String(raw.created_at) : new Date().toISOString(),
    checked_at: raw.checked_at ? String(raw.checked_at) : undefined,
  };
}

export function sanitizeItems(items: unknown): ShoppingListItem[] {
  if (!Array.isArray(items)) return [];
  return items
    .map((entry) => coerceItem(entry))
    .filter((entry): entry is ShoppingListItem => Boolean(entry));
}

export function createDefaultUserData(initialItems: ShoppingListItem[] = []): UserShoppingLists {
  const list = createListMeta();
  const now = new Date().toISOString();
  return {
    lists: [list],
    activeListId: list.id,
    itemsByList: { [list.id]: initialItems },
    updatedAt: now,
  };
}

export function getDefaultUserDataForOwner(ownerKey: string): UserShoppingLists {
  const cached = defaultUserDataByOwner.get(ownerKey);
  if (cached) return cached;

  const created = createDefaultUserData();
  defaultUserDataByOwner.set(ownerKey, created);
  return created;
}

export function hasUserData(
  dataByUser: unknown,
  ownerKey: string,
): dataByUser is Record<string, UserShoppingLists> {
  return isRecord(dataByUser) && isRecord(dataByUser[ownerKey]);
}

export function getUserDataFromState(
  dataByUser: unknown,
  userId: string | null | undefined,
): UserShoppingLists {
  const ownerKey = getOwnerKey(userId);
  if (hasUserData(dataByUser, ownerKey)) {
    return dataByUser[ownerKey];
  }
  return getDefaultUserDataForOwner(ownerKey);
}

export function getUserDataSafe(
  dataByUser: unknown,
  userId: string | null | undefined,
): UserShoppingLists {
  if (!isRecord(dataByUser)) return createDefaultUserData();
  const ownerKey = getOwnerKey(userId);
  const rawUser = dataByUser[ownerKey];
  if (!isRecord(rawUser)) return createDefaultUserData();

  const rawLists = Array.isArray(rawUser.lists) ? rawUser.lists : [];
  const lists: ShoppingListMeta[] = rawLists
    .map((entry) => {
      if (!isRecord(entry)) return null;
      const name = String(entry.name || "").trim();
      const id = String(entry.id || "").trim();
      if (!name || !id) return null;
      return {
        id,
        name,
        created_at: String(entry.created_at || new Date().toISOString()),
        updated_at: String(entry.updated_at || new Date().toISOString()),
      };
    })
    .filter((entry): entry is ShoppingListMeta => Boolean(entry));

  const normalizedLists = lists.length ? lists : [createListMeta()];
  const rawItemsByList = isRecord(rawUser.itemsByList) ? rawUser.itemsByList : {};
  const itemsByList: Record<string, ShoppingListItem[]> = {};
  for (const list of normalizedLists) {
    itemsByList[list.id] = sanitizeItems(rawItemsByList[list.id]);
  }

  const rawActive = String(rawUser.activeListId || "").trim();
  const activeListId = normalizedLists.some((l) => l.id === rawActive)
    ? rawActive
    : normalizedLists[0].id;

  return {
    lists: normalizedLists,
    activeListId,
    itemsByList,
    updatedAt: String(rawUser.updatedAt || rawUser.updated_at || new Date().toISOString()),
  };
}

export function touchUserData(
  current: UserShoppingLists,
  overrides: Partial<Omit<UserShoppingLists, "updatedAt">>,
): UserShoppingLists {
  return {
    ...current,
    ...overrides,
    updatedAt: new Date().toISOString(),
  };
}

export function bumpListUpdatedAt(
  lists: ShoppingListMeta[],
  listIds: string[],
  now: string = new Date().toISOString(),
): ShoppingListMeta[] {
  const targets = new Set(listIds);
  return lists.map((list) =>
    targets.has(list.id) ? { ...list, updated_at: now } : list,
  );
}

export function getItemsForList(
  userData: UserShoppingLists,
  listId?: string,
): ShoppingListItem[] {
  const safeListId = listId && userData.itemsByList[listId] ? listId : userData.activeListId;
  return userData.itemsByList[safeListId] || [];
}