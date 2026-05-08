import type { StoreApi } from "zustand";
import { normalizeKey } from "../../utils/normalize";
import { generateId } from "../../utils/idGenerator";
import type { ShoppingListItem } from "../../types/ui";
import { fromCloudSnapshot, toCloudSnapshot } from "./cloud";
import {
  bumpListUpdatedAt,
  createListItem,
  createListMeta,
  getItemsForList,
  getOwnerKey,
  hasUserData,
  isRecord,
  touchUserData,
} from "./core";
import type { ShoppingListState, UserShoppingLists } from "./types";

type EnsureUserData = (
  userId: string | null | undefined,
) => { ownerKey: string; userData: UserShoppingLists };

type ShoppingListActions = Omit<
  ShoppingListState,
  "dataByUser" | "getLists" | "getActiveListId" | "getItems"
>;

type BuildShoppingListActionsParams = {
  set: StoreApi<ShoppingListState>["setState"];
  get: StoreApi<ShoppingListState>["getState"];
  ensureUserData: EnsureUserData;
};

export function buildShoppingListActions({
  set,
  get,
  ensureUserData,
}: BuildShoppingListActionsParams): ShoppingListActions {
  return {
    setActiveList: (userId, listId) => {
      const { ownerKey, userData: current } = ensureUserData(userId);
      if (!current.lists.some((list) => list.id === listId)) return;

      set((state) => ({
        dataByUser: {
          ...(isRecord(state.dataByUser) ? state.dataByUser : {}),
          [ownerKey]: touchUserData(current, { activeListId: listId }),
        },
      }));
    },
    createList: (userId, name) => {
      const trimmed = name.trim();
      if (!trimmed) return { ok: false, reason: "empty" };

      const { ownerKey, userData: current } = ensureUserData(userId);
      const duplicated = current.lists.some(
        (list) => list.name.toLowerCase() === trimmed.toLowerCase(),
      );
      if (duplicated) return { ok: false, reason: "duplicate" };

      const created = createListMeta(trimmed);
      set((state) => ({
        dataByUser: {
          ...(isRecord(state.dataByUser) ? state.dataByUser : {}),
          [ownerKey]: touchUserData(current, {
            lists: [...current.lists, created],
            activeListId: created.id,
            itemsByList: {
              ...current.itemsByList,
              [created.id]: [],
            },
          }),
        },
      }));

      return { ok: true, listId: created.id };
    },
    renameList: (userId, listId, name) => {
      const trimmed = name.trim();
      if (!trimmed) return { ok: false, reason: "empty" };

      const { ownerKey, userData: current } = ensureUserData(userId);
      const target = current.lists.find((list) => list.id === listId);
      if (!target) return { ok: false, reason: "not_found" };

      const duplicated = current.lists.some(
        (list) =>
          list.id !== listId &&
          list.name.toLowerCase() === trimmed.toLowerCase(),
      );
      if (duplicated) return { ok: false, reason: "duplicate" };

      const now = new Date().toISOString();
      set((state) => ({
        dataByUser: {
          ...(isRecord(state.dataByUser) ? state.dataByUser : {}),
          [ownerKey]: touchUserData(current, {
            lists: current.lists.map((list) =>
              list.id === listId ? { ...list, name: trimmed, updated_at: now } : list,
            ),
          }),
        },
      }));

      return { ok: true, listId };
    },
    deleteList: (userId, listId) => {
      const { ownerKey, userData: current } = ensureUserData(userId);
      if (current.lists.length <= 1) return { ok: false, reason: "last_list" };
      if (!current.lists.some((list) => list.id === listId)) {
        return { ok: false, reason: "not_found" };
      }

      const remainingLists = current.lists.filter((list) => list.id !== listId);
      const nextActive =
        current.activeListId === listId ? remainingLists[0].id : current.activeListId;
      const nextItemsByList = { ...current.itemsByList };
      delete nextItemsByList[listId];

      set((state) => ({
        dataByUser: {
          ...(isRecord(state.dataByUser) ? state.dataByUser : {}),
          [ownerKey]: touchUserData(current, {
            lists: remainingLists,
            activeListId: nextActive,
            itemsByList: nextItemsByList,
          }),
        },
      }));

      return { ok: true, listId: nextActive };
    },
    addItem: (userId, name, quantity, listId) => {
      const trimmed = name.trim();
      if (!trimmed) return { ok: false, reason: "empty" };

      const { ownerKey, userData: current } = ensureUserData(userId);
      const safeListId =
        listId && current.itemsByList[listId] ? listId : current.activeListId;
      const normalized = normalizeKey(trimmed);
      const currentItems = getItemsForList(current, safeListId);
      const hasDuplicate = currentItems.some(
        (item) => item.normalized_key === normalized && !item.checked,
      );
      if (hasDuplicate) return { ok: false, reason: "duplicate" };

      const newItem = createListItem(trimmed, quantity);
      const now = new Date().toISOString();
      set((state) => ({
        dataByUser: {
          ...(isRecord(state.dataByUser) ? state.dataByUser : {}),
          [ownerKey]: touchUserData(current, {
            lists: bumpListUpdatedAt(current.lists, [safeListId], now),
            itemsByList: {
              ...current.itemsByList,
              [safeListId]: [newItem, ...currentItems],
            },
          }),
        },
      }));

      return { ok: true, item: newItem };
    },
    toggleChecked: (userId, itemId, listId) => {
      const { ownerKey, userData: current } = ensureUserData(userId);
      const safeListId =
        listId && current.itemsByList[listId] ? listId : current.activeListId;
      const currentItems = getItemsForList(current, safeListId);
      const now = new Date().toISOString();

      set((state) => ({
        dataByUser: {
          ...(isRecord(state.dataByUser) ? state.dataByUser : {}),
          [ownerKey]: touchUserData(current, {
            lists: bumpListUpdatedAt(current.lists, [safeListId], now),
            itemsByList: {
              ...current.itemsByList,
              [safeListId]: currentItems.map((item) =>
                item.id === itemId
                  ? {
                      ...item,
                      checked: !item.checked,
                      checked_at: !item.checked ? new Date().toISOString() : undefined,
                    }
                  : item,
              ),
            },
          }),
        },
      }));
    },
    removeItem: (userId, itemId, listId) => {
      const { ownerKey, userData: current } = ensureUserData(userId);
      const safeListId =
        listId && current.itemsByList[listId] ? listId : current.activeListId;
      const currentItems = getItemsForList(current, safeListId);
      const now = new Date().toISOString();

      set((state) => ({
        dataByUser: {
          ...(isRecord(state.dataByUser) ? state.dataByUser : {}),
          [ownerKey]: touchUserData(current, {
            lists: bumpListUpdatedAt(current.lists, [safeListId], now),
            itemsByList: {
              ...current.itemsByList,
              [safeListId]: currentItems.filter((item) => item.id !== itemId),
            },
          }),
        },
      }));
    },
    clearChecked: (userId, listId) => {
      const { ownerKey, userData: current } = ensureUserData(userId);
      const safeListId =
        listId && current.itemsByList[listId] ? listId : current.activeListId;
      const currentItems = getItemsForList(current, safeListId);
      const now = new Date().toISOString();

      set((state) => ({
        dataByUser: {
          ...(isRecord(state.dataByUser) ? state.dataByUser : {}),
          [ownerKey]: touchUserData(current, {
            lists: bumpListUpdatedAt(current.lists, [safeListId], now),
            itemsByList: {
              ...current.itemsByList,
              [safeListId]: currentItems.filter((item) => !item.checked),
            },
          }),
        },
      }));
    },
    clearAll: (userId, listId) => {
      const { ownerKey, userData: current } = ensureUserData(userId);
      const safeListId =
        listId && current.itemsByList[listId] ? listId : current.activeListId;
      const now = new Date().toISOString();

      set((state) => ({
        dataByUser: {
          ...(isRecord(state.dataByUser) ? state.dataByUser : {}),
          [ownerKey]: touchUserData(current, {
            lists: bumpListUpdatedAt(current.lists, [safeListId], now),
            itemsByList: {
              ...current.itemsByList,
              [safeListId]: [],
            },
          }),
        },
      }));
    },
    moveItemToList: (userId, itemId, targetListId, sourceListId) => {
      const { ownerKey, userData: current } = ensureUserData(userId);
      const safeSourceListId =
        sourceListId && current.itemsByList[sourceListId]
          ? sourceListId
          : current.activeListId;
      if (!current.itemsByList[targetListId]) return { ok: false, reason: "not_found" };
      if (targetListId === safeSourceListId) return { ok: false, reason: "same_list" };

      const sourceItems = current.itemsByList[safeSourceListId] || [];
      const targetItems = current.itemsByList[targetListId] || [];
      const sourceItem = sourceItems.find((item) => item.id === itemId);
      if (!sourceItem) return { ok: false, reason: "not_found" };

      const hasDuplicate = targetItems.some(
        (item) =>
          item.normalized_key === sourceItem.normalized_key &&
          !item.checked,
      );
      if (hasDuplicate) return { ok: false, reason: "duplicate" };
      const now = new Date().toISOString();

      set((state) => ({
        dataByUser: {
          ...(isRecord(state.dataByUser) ? state.dataByUser : {}),
          [ownerKey]: touchUserData(current, {
            lists: bumpListUpdatedAt(current.lists, [safeSourceListId, targetListId], now),
            itemsByList: {
              ...current.itemsByList,
              [safeSourceListId]: sourceItems.filter((item) => item.id !== itemId),
              [targetListId]: [sourceItem, ...targetItems],
            },
          }),
        },
      }));

      return { ok: true, item: sourceItem };
    },
    copyItemToList: (userId, itemId, targetListId, sourceListId) => {
      const { ownerKey, userData: current } = ensureUserData(userId);
      const safeSourceListId =
        sourceListId && current.itemsByList[sourceListId]
          ? sourceListId
          : current.activeListId;
      if (!current.itemsByList[targetListId]) return { ok: false, reason: "not_found" };
      if (targetListId === safeSourceListId) return { ok: false, reason: "same_list" };

      const sourceItems = current.itemsByList[safeSourceListId] || [];
      const targetItems = current.itemsByList[targetListId] || [];
      const sourceItem = sourceItems.find((item) => item.id === itemId);
      if (!sourceItem) return { ok: false, reason: "not_found" };

      const hasDuplicate = targetItems.some(
        (item) =>
          item.normalized_key === sourceItem.normalized_key &&
          !item.checked,
      );
      if (hasDuplicate) return { ok: false, reason: "duplicate" };

      const copied: ShoppingListItem = {
        ...sourceItem,
        id: generateId(),
        checked: false,
        checked_at: undefined,
        created_at: new Date().toISOString(),
      };
      const now = new Date().toISOString();

      set((state) => ({
        dataByUser: {
          ...(isRecord(state.dataByUser) ? state.dataByUser : {}),
          [ownerKey]: touchUserData(current, {
            lists: bumpListUpdatedAt(current.lists, [targetListId], now),
            itemsByList: {
              ...current.itemsByList,
              [targetListId]: [copied, ...targetItems],
            },
          }),
        },
      }));

      return { ok: true, item: copied };
    },
    getCloudSnapshot: (userId) => {
      const ownerKey = getOwnerKey(userId);
      const state = get();
      if (!hasUserData(state.dataByUser, ownerKey)) return null;
      const current = state.dataByUser[ownerKey];
      return toCloudSnapshot(current);
    },
    applyCloudSnapshot: (userId, snapshot) => {
      const parsed = fromCloudSnapshot(snapshot);
      if (!parsed) return false;

      const ownerKey = getOwnerKey(userId);
      set((state) => ({
        dataByUser: {
          ...(isRecord(state.dataByUser) ? state.dataByUser : {}),
          [ownerKey]: parsed,
        },
      }));

      return true;
    },
  };
}
