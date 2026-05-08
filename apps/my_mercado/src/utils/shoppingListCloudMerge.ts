import type { ShoppingListItem, ShoppingListMeta, ShoppingListsCloudSnapshot } from "../types/ui";

function toTimestamp(value: string | undefined): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function sortItems(items: ShoppingListItem[]): ShoppingListItem[] {
  return [...items].sort((a, b) => a.id.localeCompare(b.id));
}

function normalizeSnapshot(
  snapshot: ShoppingListsCloudSnapshot,
): ShoppingListsCloudSnapshot {
  const lists = [...snapshot.lists].sort((a, b) => a.id.localeCompare(b.id));
  const itemsByList: Record<string, ShoppingListItem[]> = {};

  for (const list of lists) {
    itemsByList[list.id] = sortItems(snapshot.items_by_list[list.id] || []);
  }

  return {
    version: 1,
    updated_at: snapshot.updated_at,
    active_list_id: snapshot.active_list_id,
    lists,
    items_by_list: itemsByList,
  };
}

export function isSameShoppingListSnapshot(
  a: ShoppingListsCloudSnapshot,
  b: ShoppingListsCloudSnapshot,
): boolean {
  return JSON.stringify(normalizeSnapshot(a)) === JSON.stringify(normalizeSnapshot(b));
}

function selectNewerList(
  localList: ShoppingListMeta,
  remoteList: ShoppingListMeta,
): "local" | "remote" {
  const localTs = toTimestamp(localList.updated_at);
  const remoteTs = toTimestamp(remoteList.updated_at);
  if (remoteTs > localTs) return "remote";
  return "local";
}

export function mergeShoppingListSnapshots(
  local: ShoppingListsCloudSnapshot,
  remote: ShoppingListsCloudSnapshot,
): ShoppingListsCloudSnapshot {
  const localById = new Map(local.lists.map((list) => [list.id, list]));
  const remoteById = new Map(remote.lists.map((list) => [list.id, list]));
  const allIds = new Set([...localById.keys(), ...remoteById.keys()]);

  const mergedLists: ShoppingListMeta[] = [];
  const mergedItemsByList: Record<string, ShoppingListItem[]> = {};

  for (const listId of allIds) {
    const localList = localById.get(listId);
    const remoteList = remoteById.get(listId);

    if (localList && remoteList) {
      const winner = selectNewerList(localList, remoteList);
      const selectedList = winner === "remote" ? remoteList : localList;
      const selectedItems =
        winner === "remote"
          ? remote.items_by_list[listId] || []
          : local.items_by_list[listId] || [];

      mergedLists.push(selectedList);
      mergedItemsByList[listId] = selectedItems;
      continue;
    }

    if (localList) {
      mergedLists.push(localList);
      mergedItemsByList[listId] = local.items_by_list[listId] || [];
      continue;
    }

    if (remoteList) {
      mergedLists.push(remoteList);
      mergedItemsByList[listId] = remote.items_by_list[listId] || [];
    }
  }

  mergedLists.sort((a, b) => a.created_at.localeCompare(b.created_at));
  const mergedIds = new Set(mergedLists.map((list) => list.id));

  const activeListId = mergedIds.has(local.active_list_id)
    ? local.active_list_id
    : mergedIds.has(remote.active_list_id)
      ? remote.active_list_id
      : mergedLists[0]?.id || "";

  const maxTs = Math.max(toTimestamp(local.updated_at), toTimestamp(remote.updated_at));
  const updatedAt = maxTs > 0 ? new Date(maxTs).toISOString() : new Date().toISOString();

  const merged: ShoppingListsCloudSnapshot = {
    version: 1,
    updated_at: updatedAt,
    active_list_id: activeListId,
    lists: mergedLists,
    items_by_list: mergedItemsByList,
  };

  if (isSameShoppingListSnapshot(merged, local)) return local;
  if (isSameShoppingListSnapshot(merged, remote)) return remote;

  return {
    ...merged,
    updated_at: new Date().toISOString(),
  };
}
