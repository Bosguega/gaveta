import { supabase, isSupabaseConfigured } from "./supabaseClient";

function requireSupabase(): NonNullable<typeof supabase> {
    if (!isSupabaseConfigured || !supabase) {
        throw new Error("Supabase não configurado.");
    }
    return supabase;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CollaborativeList {
    id: string;
    name: string;
    code: string;
    owner_id: string;
    created_at: string;
    updated_at: string;
}

export interface CollaborativeListItem {
    id: string;
    list_id: string;
    name: string;
    quantity: string | null;
    checked: boolean;
    created_by: string;
    created_at: string;
    updated_at: string;
}

export interface CollaborativeListMember {
    id: string;
    list_id: string;
    user_id: string;
    role: "owner" | "editor" | "viewer";
    email?: string;
    created_at: string;
}

// ---------------------------------------------------------------------------
// Lists
// ---------------------------------------------------------------------------

export async function getCollaborativeListsFromDB(): Promise<CollaborativeList[]> {
    const client = requireSupabase();
    const { data, error } = await client
        .from("collaborative_lists")
        .select("*")
        .order("updated_at", { ascending: false });

    if (error) throw new Error(error.message);
    return data ?? [];
}

export async function createCollaborativeListInDB(): Promise<CollaborativeList> {
    const client = requireSupabase();
    const { data, error } = await client
        .from("collaborative_lists")
        .insert({ name: "Nova lista" })
        .select()
        .single();

    if (error) throw new Error(error.message);
    return data;
}

export async function joinCollaborativeListByCodeInDB(
    code: string,
): Promise<CollaborativeList> {
    const client = requireSupabase();
    const { data, error } = await client
        .from("collaborative_lists")
        .select("*")
        .eq("code", code)
        .single();

    if (error) throw new Error("Lista não encontrada com este código.");
    return data;
}

export async function renameCollaborativeListInDB(
    listId: string,
    name: string,
): Promise<void> {
    const client = requireSupabase();
    const { error } = await client
        .from("collaborative_lists")
        .update({ name, updated_at: new Date().toISOString() })
        .eq("id", listId);

    if (error) throw new Error(error.message);
}

export async function deleteCollaborativeListInDB(
    listId: string,
): Promise<void> {
    const client = requireSupabase();
    const { error } = await client
        .from("collaborative_lists")
        .delete()
        .eq("id", listId);

    if (error) throw new Error(error.message);
}

export async function regenerateCollaborativeListCodeInDB(
    listId: string,
): Promise<string> {
    const client = requireSupabase();
    const newCode = generateJoinCode();
    const { error } = await client
        .from("collaborative_lists")
        .update({ code: newCode, updated_at: new Date().toISOString() })
        .eq("id", listId);

    if (error) throw new Error(error.message);
    return newCode;
}

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------

export async function getCollaborativeListItemsFromDB(
    listId: string,
): Promise<CollaborativeListItem[]> {
    const client = requireSupabase();
    const { data, error } = await client
        .from("collaborative_list_items")
        .select("*")
        .eq("list_id", listId)
        .order("created_at", { ascending: true });

    if (error) throw new Error(error.message);
    return data ?? [];
}

export async function addCollaborativeListItemToDB(
    listId: string,
    name: string,
    quantity?: string,
): Promise<CollaborativeListItem> {
    const client = requireSupabase();
    const { data, error } = await client
        .from("collaborative_list_items")
        .insert({ list_id: listId, name, quantity: quantity ?? null })
        .select()
        .single();

    if (error) throw new Error(error.message);
    return data;
}

export async function toggleCollaborativeListItemInDB(
    listId: string,
    itemId: string,
    nextChecked: boolean,
): Promise<void> {
    const client = requireSupabase();
    const { error } = await client
        .from("collaborative_list_items")
        .update({ checked: nextChecked, updated_at: new Date().toISOString() })
        .eq("id", itemId)
        .eq("list_id", listId);

    if (error) throw new Error(error.message);
}

export async function removeCollaborativeListItemFromDB(
    listId: string,
    itemId: string,
): Promise<void> {
    const client = requireSupabase();
    const { error } = await client
        .from("collaborative_list_items")
        .delete()
        .eq("id", itemId)
        .eq("list_id", listId);

    if (error) throw new Error(error.message);
}

export async function clearCollaborativeListItemsInDB(
    listId: string,
    onlyChecked: boolean,
): Promise<void> {
    const client = requireSupabase();
    let query = client
        .from("collaborative_list_items")
        .delete()
        .eq("list_id", listId);

    if (onlyChecked) {
        query = query.eq("checked", true);
    }

    const { error } = await query;
    if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------

export async function getCollaborativeListMembersFromDB(
    listId: string,
): Promise<CollaborativeListMember[]> {
    const client = requireSupabase();
    const { data, error } = await client
        .from("collaborative_list_members")
        .select("*")
        .eq("list_id", listId);

    if (error) throw new Error(error.message);
    return data ?? [];
}

export async function removeCollaborativeListMemberFromDB(
    listId: string,
    userId: string,
): Promise<void> {
    const client = requireSupabase();
    const { error } = await client
        .from("collaborative_list_members")
        .delete()
        .eq("list_id", listId)
        .eq("user_id", userId);

    if (error) throw new Error(error.message);
}

export async function updateCollaborativeListMemberRoleInDB(
    listId: string,
    userId: string,
    role: "editor" | "viewer",
): Promise<void> {
    const client = requireSupabase();
    const { error } = await client
        .from("collaborative_list_members")
        .update({ role })
        .eq("list_id", listId)
        .eq("user_id", userId);

    if (error) throw new Error(error.message);
}

export async function transferCollaborativeListOwnershipInDB(
    listId: string,
    newOwnerUserId: string,
): Promise<void> {
    const client = requireSupabase();
    // Demote current owner to editor
    const { data: members, error: fetchError } = await client
        .from("collaborative_list_members")
        .select("user_id, role")
        .eq("list_id", listId);

    if (fetchError) throw new Error(fetchError.message);

    const currentOwner = members?.find((m) => m.role === "owner");
    if (!currentOwner) throw new Error("Current owner not found.");

    // Update list owner_id
    const { error: listError } = await client
        .from("collaborative_lists")
        .update({ owner_id: newOwnerUserId, updated_at: new Date().toISOString() })
        .eq("id", listId);

    if (listError) throw new Error(listError.message);

    // Demote old owner
    const { error: demoteError } = await client
        .from("collaborative_list_members")
        .update({ role: "editor" })
        .eq("list_id", listId)
        .eq("user_id", currentOwner.user_id);

    if (demoteError) throw new Error(demoteError.message);

    // Promote new owner
    const { error: promoteError } = await client
        .from("collaborative_list_members")
        .update({ role: "owner" })
        .eq("list_id", listId)
        .eq("user_id", newOwnerUserId);

    if (promoteError) throw new Error(promoteError.message);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateJoinCode(): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "";
    for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}