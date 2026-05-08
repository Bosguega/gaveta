const SHOPPING_LIST_CLOUD_SYNC_KEY = "@MyMercado:shopping-list-cloud-sync-enabled";

export function isShoppingListCloudSyncEnabled(): boolean {
  try {
    return localStorage.getItem(SHOPPING_LIST_CLOUD_SYNC_KEY) === "1";
  } catch {
    return false;
  }
}

export function setShoppingListCloudSyncEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(SHOPPING_LIST_CLOUD_SYNC_KEY, enabled ? "1" : "0");
  } catch {
    // noop
  }
}
