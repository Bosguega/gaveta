import type { ShoppingListMeta, ShoppingListsCloudSnapshot } from "../../types/ui";
import type { UserShoppingLists } from "./types";
import { isRecord, sanitizeItems } from "./core";

export function toCloudSnapshot(userData: UserShoppingLists): ShoppingListsCloudSnapshot {
  return {
    version: 1,
    updated_at: userData.updatedAt,
    lists: userData.lists,
    active_list_id: userData.activeListId,
    items_by_list: userData.itemsByList,
  };
}

export function fromCloudSnapshot(raw: unknown): UserShoppingLists | null {
  if (!isRecord(raw)) return null;

  const rawLists = Array.isArray(raw.lists) ? raw.lists : [];
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

  if (!lists.length) return null;

  const rawItemsByList = isRecord(raw.items_by_list) ? raw.items_by_list : {};
  const itemsByList: Record<string, ReturnType<typeof sanitizeItems>> = {};
  for (const list of lists) {
    itemsByList[list.id] = sanitizeItems(rawItemsByList[list.id]);
  }

  const requestedActiveListId = String(raw.active_list_id || "").trim();
  const activeListId = lists.some((list) => list.id === requestedActiveListId)
    ? requestedActiveListId
    : lists[0].id;

  return {
    lists,
    activeListId,
    itemsByList,
    updatedAt: String(raw.updated_at || new Date().toISOString()),
  };
}
