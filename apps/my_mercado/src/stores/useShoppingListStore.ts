import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  getDefaultUserDataForOwner,
  getItemsForList,
  getOwnerKey,
  getUserDataFromState,
  hasUserData,
  isRecord,
} from "./shoppingListStore/core";
import { migrateShoppingListState } from "./shoppingListStore/migrations";
import { buildShoppingListActions } from "./shoppingListStore/actions";
import type { ShoppingListState, UserShoppingLists } from "./shoppingListStore/types";

export const useShoppingListStore = create<ShoppingListState>()(
  persist(
    (set, get) => {
      const ensureUserData = (
        userId: string | null | undefined,
      ): { ownerKey: string; userData: UserShoppingLists } => {
        const ownerKey = getOwnerKey(userId);
        const state = get();
        if (hasUserData(state.dataByUser, ownerKey)) {
          return {
            ownerKey,
            userData: state.dataByUser[ownerKey],
          };
        }

        const initialized = getDefaultUserDataForOwner(ownerKey);
        set((prev) => ({
          dataByUser: {
            ...(isRecord(prev.dataByUser) ? prev.dataByUser : {}),
            [ownerKey]: initialized,
          },
        }));

        return { ownerKey, userData: initialized };
      };

      return {
        dataByUser: {},
        getLists: (userId) => getUserDataFromState(get().dataByUser, userId).lists,
        getActiveListId: (userId) => getUserDataFromState(get().dataByUser, userId).activeListId,
        getItems: (userId, listId) =>
          getItemsForList(getUserDataFromState(get().dataByUser, userId), listId),
        ...buildShoppingListActions({ set, get, ensureUserData }),
      };
    },
    {
      name: "@MyMercado:shopping-list",
      version: 3,
      storage: createJSONStorage(() => localStorage),
      migrate: migrateShoppingListState,
    },
  ),
);
