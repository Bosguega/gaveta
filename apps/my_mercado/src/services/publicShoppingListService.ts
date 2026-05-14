import { supabase } from "./supabaseClient";
import type { CollaborativeShoppingList, CollaborativeShoppingListItem } from "../types/domain";

/**
 * Busca uma lista e seus itens usando apenas o código de compartilhamento.
 * Não requer autenticação, desde que o RLS do Supabase permita.
 */
export async function getPublicListByCode(code: string): Promise<{ 
  list: CollaborativeShoppingList; 
  items: CollaborativeShoppingListItem[] 
} | null> {
  if (!supabase) return null;

  // 1. Busca a lista pelo share_code
  const { data: list, error: listError } = await supabase
    .from("shopping_lists")
    .select("id, owner_user_id, name, share_code, created_at, updated_at")
    .eq("share_code", code)
    .single();

  if (listError || !list) {
    console.error("Erro ao buscar lista pública:", listError);
    return null;
  }

  // 2. Busca os itens da lista
  const { data: items, error: itemsError } = await supabase
    .from("shopping_list_items")
    .select("*")
    .eq("list_id", list.id)
    .order("created_at", { ascending: true });

  if (itemsError) {
    console.error("Erro ao buscar itens públicos:", itemsError);
    return null;
  }

  return {
    list: { ...list, role: "viewer" } as CollaborativeShoppingList,
    items: (items || []) as CollaborativeShoppingListItem[]
  };
}

/**
 * Alterna o estado de um item em uma lista pública.
 */
export async function togglePublicItem(itemId: string, checked: boolean): Promise<boolean> {
  if (!supabase) return false;

  const { error } = await supabase
    .from("shopping_list_items")
    .update({ 
      checked,
      checked_at: checked ? new Date().toISOString() : null
    })
    .eq("id", itemId);

  return !error;
}
