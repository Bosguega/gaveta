import { normalizeKey } from "../utils/normalize";
import type {
  CollaborativeShoppingList,
  CollaborativeShoppingListItem,
  CollaborativeShoppingListMember,
  ShoppingListMemberRole,
} from "../types/domain";
import { getAuthenticatedSupabaseContext } from "./authService";

type MemberRow = {
  list_id: string;
  role: ShoppingListMemberRole;
};

const DUPLICATE_PENDING_ITEM_ERROR = "duplicate_pending_item";
const UNIQUE_PENDING_ITEM_INDEX = "ux_shopping_list_items_pending_normalized_key";

export function isDuplicatePendingItemError(error: unknown): boolean {
  if (error instanceof Error && error.message === DUPLICATE_PENDING_ITEM_ERROR) {
    return true;
  }

  if (!error || typeof error !== "object") return false;
  const candidate = error as {
    code?: unknown;
    message?: unknown;
    details?: unknown;
  };

  if (candidate.code !== "23505") return false;
  const message = typeof candidate.message === "string" ? candidate.message : "";
  const details = typeof candidate.details === "string" ? candidate.details : "";
  const text = `${message} ${details}`.toLowerCase();

  return (
    text.includes(UNIQUE_PENDING_ITEM_INDEX) ||
    (text.includes("shopping_list_items") &&
      text.includes("list_id") &&
      text.includes("normalized_key"))
  );
}

export async function getCollaborativeListsFromDB(): Promise<CollaborativeShoppingList[]> {
  const { client, user } = await getAuthenticatedSupabaseContext();

  const { data: memberRows, error: memberError } = await client
    .from("shopping_list_members")
    .select("list_id, role")
    .eq("user_id", user.id);

  if (memberError) throw memberError;
  const memberships = (memberRows || []) as MemberRow[];
  const ids = memberships.map((entry) => entry.list_id);
  if (!ids.length) return [];

  const { data: lists, error: listError } = await client
    .from("shopping_lists")
    .select("id, owner_user_id, name, share_code, created_at, updated_at")
    .in("id", ids)
    .order("updated_at", { ascending: false });

  if (listError) throw listError;
  const roleById = new Map(memberships.map((entry) => [entry.list_id, entry.role]));

  return (lists || []).map((row) => ({
    ...(row as CollaborativeShoppingList),
    role: roleById.get(String((row as { id: string }).id)),
  }));
}

export async function createCollaborativeListInDB(
  name: string,
): Promise<CollaborativeShoppingList> {
  const { client, user } = await getAuthenticatedSupabaseContext();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Nome da lista é obrigatório.");

  const { data, error } = await client
    .from("shopping_lists")
    .insert({
      owner_user_id: user.id,
      name: trimmed,
    })
    .select("id, owner_user_id, name, share_code, created_at, updated_at")
    .single();

  if (error) throw error;
  return { ...(data as CollaborativeShoppingList), role: "owner" };
}

export async function joinCollaborativeListByCodeInDB(
  code: string,
): Promise<CollaborativeShoppingList> {
  const { client, user } = await getAuthenticatedSupabaseContext();
  const trimmed = code.trim();
  if (!trimmed) throw new Error("Código de compartilhamento inválido.");

  const { data: listId, error: rpcError } = await client.rpc("join_shopping_list_by_code", {
    p_code: trimmed,
  });
  if (rpcError) throw rpcError;

  const { data, error } = await client
    .from("shopping_lists")
    .select("id, owner_user_id, name, share_code, created_at, updated_at")
    .eq("id", listId)
    .single();
  if (error) throw error;

  const { data: membership, error: memberError } = await client
    .from("shopping_list_members")
    .select("role")
    .eq("list_id", listId)
    .eq("user_id", user.id)
    .single();
  if (memberError) throw memberError;

  return {
    ...(data as CollaborativeShoppingList),
    role: (membership as { role: ShoppingListMemberRole }).role,
  };
}

export async function getCollaborativeListItemsFromDB(
  listId: string,
): Promise<CollaborativeShoppingListItem[]> {
  const { client } = await getAuthenticatedSupabaseContext();
  const { data, error } = await client
    .from("shopping_list_items")
    .select(
      "id, list_id, name, normalized_key, quantity, checked, checked_at, checked_by_user_id, created_at, updated_at",
    )
    .eq("list_id", listId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []) as CollaborativeShoppingListItem[];
}

export async function addCollaborativeListItemToDB(
  listId: string,
  name: string,
  quantity?: string,
): Promise<CollaborativeShoppingListItem> {
  const { client } = await getAuthenticatedSupabaseContext();
  const trimmedName = name.trim();
  if (!trimmedName) throw new Error("Nome do item é obrigatório.");
  const normalizedName = normalizeKey(trimmedName);

  const { data: duplicateItem, error: duplicateError } = await client
    .from("shopping_list_items")
    .select("id")
    .eq("list_id", listId)
    .eq("normalized_key", normalizedName)
    .eq("checked", false)
    .limit(1)
    .maybeSingle();
  if (duplicateError) throw duplicateError;
  if (duplicateItem) throw new Error(DUPLICATE_PENDING_ITEM_ERROR);

  const { data, error } = await client
    .from("shopping_list_items")
    .insert({
      list_id: listId,
      name: trimmedName,
      normalized_key: normalizedName,
      quantity: quantity?.trim() || null,
    })
    .select(
      "id, list_id, name, normalized_key, quantity, checked, checked_at, checked_by_user_id, created_at, updated_at",
    )
    .single();
  if (error) throw error;
  return data as CollaborativeShoppingListItem;
}

export async function toggleCollaborativeListItemInDB(
  listId: string,
  itemId: string,
  nextChecked: boolean,
): Promise<void> {
  const { client, user } = await getAuthenticatedSupabaseContext();
  const { error } = await client
    .from("shopping_list_items")
    .update({
      checked: nextChecked,
      checked_at: nextChecked ? new Date().toISOString() : null,
      checked_by_user_id: nextChecked ? user.id : null,
    })
    .eq("list_id", listId)
    .eq("id", itemId);
  if (error) throw error;
}

export async function removeCollaborativeListItemFromDB(
  listId: string,
  itemId: string,
): Promise<void> {
  const { client } = await getAuthenticatedSupabaseContext();
  const { error } = await client
    .from("shopping_list_items")
    .delete()
    .eq("list_id", listId)
    .eq("id", itemId);
  if (error) throw error;
}

export async function clearCollaborativeListItemsInDB(
  listId: string,
  onlyChecked: boolean,
): Promise<void> {
  const { client } = await getAuthenticatedSupabaseContext();
  const query = client.from("shopping_list_items").delete().eq("list_id", listId);
  const { error } = onlyChecked ? await query.eq("checked", true) : await query;
  if (error) throw error;
}

export async function renameCollaborativeListInDB(
  listId: string,
  name: string,
): Promise<void> {
  const { client } = await getAuthenticatedSupabaseContext();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Nome da lista é obrigatório.");
  const { error } = await client
    .from("shopping_lists")
    .update({ name: trimmed })
    .eq("id", listId);
  if (error) throw error;
}

export async function deleteCollaborativeListInDB(listId: string): Promise<void> {
  const { client } = await getAuthenticatedSupabaseContext();
  const { error } = await client.from("shopping_lists").delete().eq("id", listId);
  if (error) throw error;
}

export async function regenerateCollaborativeListCodeInDB(
  listId: string,
): Promise<string> {
  const { client } = await getAuthenticatedSupabaseContext();
  const nextCode = crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase();
  const { data, error } = await client
    .from("shopping_lists")
    .update({ share_code: nextCode })
    .eq("id", listId)
    .select("share_code")
    .single();
  if (error) throw error;
  return String((data as { share_code: string }).share_code || nextCode);
}

export async function getCollaborativeListMembersFromDB(
  listId: string,
): Promise<CollaborativeShoppingListMember[]> {
  const { client } = await getAuthenticatedSupabaseContext();
  const { data, error } = await client
    .from("shopping_list_members")
    .select("list_id, user_id, role, created_at")
    .eq("list_id", listId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data || []) as CollaborativeShoppingListMember[];
}

export async function updateCollaborativeListMemberRoleInDB(
  listId: string,
  userId: string,
  role: Exclude<ShoppingListMemberRole, "owner">,
): Promise<void> {
  const { client } = await getAuthenticatedSupabaseContext();
  const { error } = await client
    .from("shopping_list_members")
    .update({ role })
    .eq("list_id", listId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function removeCollaborativeListMemberFromDB(
  listId: string,
  userId: string,
): Promise<void> {
  const { client } = await getAuthenticatedSupabaseContext();
  const { error } = await client
    .from("shopping_list_members")
    .delete()
    .eq("list_id", listId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function transferCollaborativeListOwnershipInDB(
  listId: string,
  newOwnerUserId: string,
): Promise<void> {
  const { client } = await getAuthenticatedSupabaseContext();
  const { error } = await client.rpc("transfer_shopping_list_ownership", {
    p_list_id: listId,
    p_new_owner_id: newOwnerUserId,
  });
  if (error) throw error;
}
