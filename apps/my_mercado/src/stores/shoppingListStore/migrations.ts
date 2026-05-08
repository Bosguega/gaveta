import type { ShoppingListState, UserShoppingLists } from "./types";
import {
  createDefaultUserData,
  getUserDataSafe,
  isRecord,
  sanitizeItems,
} from "./core";

export function migrateShoppingListState(
  persistedState: unknown,
  version: number,
): ShoppingListState {
  if (version >= 3) {
    return persistedState as ShoppingListState;
  }

  if (version === 2) {
    const stateV2 = persistedState as { dataByUser?: Record<string, unknown> };
    const rawDataByUser = isRecord(stateV2?.dataByUser) ? stateV2.dataByUser : {};
    const dataByUser: Record<string, UserShoppingLists> = {};

    for (const [ownerKey, rawUserData] of Object.entries(rawDataByUser)) {
      const parsed = getUserDataSafe({ [ownerKey]: rawUserData }, ownerKey);
      dataByUser[ownerKey] = parsed;
    }

    return { dataByUser } as ShoppingListState;
  }

  const oldState = persistedState as { itemsByUser?: Record<string, unknown> };
  const oldItemsByUser = isRecord(oldState?.itemsByUser) ? oldState.itemsByUser : {};
  const dataByUser: Record<string, UserShoppingLists> = {};

  for (const [ownerKey, rawItems] of Object.entries(oldItemsByUser)) {
    dataByUser[ownerKey] = createDefaultUserData(sanitizeItems(rawItems));
  }

  return { dataByUser } as ShoppingListState;
}
