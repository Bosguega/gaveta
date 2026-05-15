import { supabase, isSupabaseConfigured } from "./supabaseClient";
import { useShoppingListStore } from "../stores/useShoppingListStore";
import { pushSnapshot, pullSnapshot } from "./shoppingListSnapshotService";
import {
  isSameShoppingListSnapshot,
  mergeShoppingListSnapshots,
} from "../utils/shoppingListCloudMerge";
import type { ShoppingListsCloudSnapshot } from "../types/ui";

type SyncStatus = "disabled" | "skipped" | "pushed" | "pulled" | "unchanged";

export type ShoppingListCloudSyncResult = {
  status: SyncStatus;
  reason?: string;
};

function requireSupabase() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase não configurado.");
  }
  return supabase;
}

export async function syncShoppingListsWithCloud(
  userId: string,
): Promise<ShoppingListCloudSyncResult> {
  try {
    requireSupabase();
  } catch {
    return { status: "skipped", reason: "supabase_unavailable" };
  }

  if (!userId || userId === "__local__") {
    return { status: "skipped", reason: "no_user" };
  }

  const store = useShoppingListStore.getState();
  const localSnapshot = store.getCloudSnapshot(userId);
  let remoteSnapshot: ShoppingListsCloudSnapshot | null = null;

  try {
    remoteSnapshot = await pullSnapshot(userId);
  } catch {
    return { status: "skipped", reason: "pull_failed" };
  }

  if (!localSnapshot && !remoteSnapshot) return { status: "unchanged" };

  if (localSnapshot && !remoteSnapshot) {
    try {
      await pushSnapshot(userId, localSnapshot);
      return { status: "pushed" };
    } catch {
      return { status: "skipped", reason: "push_failed" };
    }
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
    try {
      await pushSnapshot(userId, mergedSnapshot);
      return localEqualsMerged ? { status: "pushed" } : { status: "pulled" };
    } catch {
      return { status: "skipped", reason: "push_failed" };
    }
  }

  return { status: "unchanged" };
}