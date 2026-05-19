import { supabase, isSupabaseConfigured } from "./supabaseClient";
import type { ShoppingListsCloudSnapshot } from "../types/ui";

function requireSupabase() {
    if (!isSupabaseConfigured || !supabase) {
        throw new Error("Supabase nao configurado.");
    }
    return supabase;
}

/**
 * Envia (upsert) um snapshot de listas de compras para o Supabase.
 */
export async function pushSnapshot(
    userId: string,
    snapshot: ShoppingListsCloudSnapshot,
): Promise<void> {
    const client = requireSupabase();

    const { error } = await client.from("shopping_list_snapshots").upsert(
        {
            user_id: userId,
            data: snapshot,
            updated_at: snapshot.updated_at,
        },
        { onConflict: "user_id" },
    );

    if (error) throw new Error(error.message);
}

/**
 * Busca o snapshot de listas de compras do usuario no Supabase.
 */
export async function pullSnapshot(
    userId: string,
): Promise<ShoppingListsCloudSnapshot | null> {
    const client = requireSupabase();

    const { data, error } = await client
        .from("shopping_list_snapshots")
        .select("data")
        .eq("user_id", userId)
        .maybeSingle();

    if (error) throw new Error(error.message);
    return data?.data ?? null;
}

/**
 * Remove o snapshot do usuario no Supabase.
 */
export async function deleteSnapshot(userId: string): Promise<void> {
    const client = requireSupabase();

    const { error } = await client
        .from("shopping_list_snapshots")
        .delete()
        .eq("user_id", userId);

    if (error) throw new Error(error.message);
}