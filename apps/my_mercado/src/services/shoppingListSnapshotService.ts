import { supabase, isSupabaseConfigured } from "./supabaseClient";
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

export async function pushSnapshot(
    userId: string,
    snapshot: ShoppingListsCloudSnapshot,
): Promise<void> {
    const client = requireSupabase();
    const { error } = await client
        .from("shopping_list_snapshots")
        .upsert(
            {
                user_id: userId,
                snapshot,
                version: 1,
            },
            { onConflict: "user_id" },
        );

    if (error) throw new Error(error.message);
}

export async function pullSnapshot(
    userId: string,
): Promise<ShoppingListsCloudSnapshot | null> {
    const client = requireSupabase();
    const { data, error } = await client
        .from("shopping_list_snapshots")
        .select("snapshot")
        .eq("user_id", userId)
        .single();

    if (error) {
        // PGRST116 = no rows found (ainda não tem snapshot)
        if ((error as { code?: string }).code === "PGRST116") return null;
        throw new Error(error.message);
    }

    return data?.snapshot as ShoppingListsCloudSnapshot | null;
}

export async function deleteSnapshot(userId: string): Promise<void> {
    const client = requireSupabase();
    const { error } = await client
        .from("shopping_list_snapshots")
        .delete()
        .eq("user_id", userId);

    if (error) throw new Error(error.message);
}