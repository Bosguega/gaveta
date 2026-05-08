import type { ShoppingListItem, ShoppingListMeta, ShoppingListsCloudSnapshot } from "../../types/ui";

export type UserShoppingLists = {
  lists: ShoppingListMeta[];
  activeListId: string;
  itemsByList: Record<string, ShoppingListItem[]>;
  updatedAt: string;
};

export type AddItemResult =
  | { ok: true; item: ShoppingListItem }
  | { ok: false; reason: "empty" | "duplicate" };

export type ListOperationResult =
  | { ok: true; listId: string }
  | { ok: false; reason: "empty" | "duplicate" | "not_found" | "last_list" };

export type MoveOrCopyResult =
  | { ok: true; item: ShoppingListItem }
  | { ok: false; reason: "not_found" | "same_list" | "duplicate" };

/**
 * Estado e operações do Shopping List Store.
 */
export type ShoppingListState = {
  dataByUser: Record<string, UserShoppingLists>;
  getLists: (userId: string | null | undefined) => ShoppingListMeta[];
  getActiveListId: (userId: string | null | undefined) => string;
  getItems: (userId: string | null | undefined, listId?: string) => ShoppingListItem[];
  setActiveList: (userId: string | null | undefined, listId: string) => void;
  createList: (userId: string | null | undefined, name: string) => ListOperationResult;
  renameList: (
    userId: string | null | undefined,
    listId: string,
    name: string,
  ) => ListOperationResult;
  deleteList: (userId: string | null | undefined, listId: string) => ListOperationResult;
  addItem: (
    userId: string | null | undefined,
    name: string,
    quantity?: string,
    listId?: string,
  ) => AddItemResult;
  toggleChecked: (
    userId: string | null | undefined,
    itemId: string,
    listId?: string,
  ) => void;
  removeItem: (
    userId: string | null | undefined,
    itemId: string,
    listId?: string,
  ) => void;
  clearChecked: (userId: string | null | undefined, listId?: string) => void;
  clearAll: (userId: string | null | undefined, listId?: string) => void;
  moveItemToList: (
    userId: string | null | undefined,
    itemId: string,
    targetListId: string,
    sourceListId?: string,
  ) => MoveOrCopyResult;
  copyItemToList: (
    userId: string | null | undefined,
    itemId: string,
    targetListId: string,
    sourceListId?: string,
  ) => MoveOrCopyResult;
  getCloudSnapshot: (
    userId: string | null | undefined,
  ) => ShoppingListsCloudSnapshot | null;
  applyCloudSnapshot: (
    userId: string | null | undefined,
    snapshot: unknown,
  ) => boolean;
};
