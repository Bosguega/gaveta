import { supabase } from "./supabaseClient";
import { useShoppingListStore } from "../stores/useShoppingListStore";
import type { ShoppingListsCloudSnapshot } from "../types/ui";
import {
  isSameShoppingListSnapshot,
  mergeShoppingListSnapshots,
} from "../utils/shoppingListCloudMerge";

const SHOPPING_LIST_META_KEY = "mymercado_shopping_lists_v1";

type SyncStatus = "disabled" | "skipped" | "pushed" | "pulled" | "unchanged";

export type ShoppingListCloudSyncResult = {
  status: SyncStatus;
  reason?: string;
};

function getRemoteSnapshotValue(
  user: { user_metadata?: Record<string, unknown> } | null,
): unknown {
  if (!user || !user.user_metadata) return null;
  return user.user_metadata[SHOPPING_LIST_META_KEY];
}

function parseRemoteSnapshot(raw: unknown): ShoppingListsCloudSnapshot | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const candidate = raw as Partial<ShoppingListsCloudSnapshot>;
  if (candidate.version !== 1) return null;
  if (typeof candidate.updated_at !== "string") return null;
  if (!Array.isArray(candidate.lists)) return null;
  if (!candidate.items_by_list || typeof candidate.items_by_list !== "object") return null;
  if (typeof candidate.active_list_id !== "string") return null;
  return candidate as ShoppingListsCloudSnapshot;
}

export async function syncShoppingListsWithCloud(
  userId: string,
): Promise<ShoppingListCloudSyncResult> {
  if (!supabase) return { status: "skipped", reason: "supabase_unavailable" };

  const { data: userData, error: getUserError } = await supabase.auth.getUser();
  if (getUserError) return { status: "skipped", reason: "auth_unavailable" };

  const store = useShoppingListStore.getState();
  const localSnapshot = store.getCloudSnapshot(userId);
  const remoteSnapshot = parseRemoteSnapshot(getRemoteSnapshotValue(userData.user));

  if (!localSnapshot && !remoteSnapshot) return { status: "unchanged" };

  if (localSnapshot && !remoteSnapshot) {
    const nextMeta = {
      ...(userData.user?.user_metadata || {}),
      [SHOPPING_LIST_META_KEY]: localSnapshot,
    };
    const { error: updateError } = await supabase.auth.updateUser({ data: nextMeta });
    if (updateError) return { status: "skipped", reason: "update_failed" };
    return { status: "pushed" };
  }

  if (!localSnapshot && remoteSnapshot) {
    const applied = store.applyCloudSnapshot(userId, remoteSnapshot);
    return applied ? { status: "pulled" } : { status: "skipped", reason: "invalid_remote" };
  }

  if (!localSnapshot || !remoteSnapshot) return { status: "unchanged" };

  const mergedSnapshot = mergeShoppingListSnapshots(localSnapshot, remoteSnapshot);
  const localEqualsMerged = isSameShoppingListSnapshot(localSnapshot, mergedSnapshot);
  const remoteEqualsMerged = isSameShoppingListSnapshot(remoteSnapshot, mergedSnapshot);

  if (!localEqualsMerged) {
    const applied = store.applyCloudSnapshot(userId, mergedSnapshot);
    if (!applied) return { status: "skipped", reason: "invalid_merged" };
  }

  if (!remoteEqualsMerged) {
    const nextMeta = {
      ...(userData.user?.user_metadata || {}),
      [SHOPPING_LIST_META_KEY]: mergedSnapshot,
    };
    const { error: updateError } = await supabase.auth.updateUser({ data: nextMeta });
    if (updateError) return { status: "skipped", reason: "update_failed" };
    return localEqualsMerged ? { status: "pushed" } : { status: "pulled" };
  }

  return localEqualsMerged ? { status: "unchanged" } : { status: "pulled" };
}
