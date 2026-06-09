import { getAuthenticatedSupabaseContext } from "./authService";
import type { DictionaryEntry, DictionaryMap } from "../types/domain";
import { mapSupabaseError } from "../utils/supabaseError";
import { normalizeCategory } from "../utils/categoryNormalizer";

interface DbDictionaryRow {
  key: string;
  normalized_name: string;
  category?: string | null;
}

export type DictionaryUpdateEntry = Pick<
  DictionaryEntry,
  "key" | "normalized_name" | "category"
>;

// =========================
// DICTIONARY CRUD
// =========================

/**
 * Busca todas as entradas do dicionário
 */
export async function getFullDictionaryFromDB(): Promise<DictionaryEntry[]> {
  const { client, user } = await getAuthenticatedSupabaseContext();

  const { data, error } = await client
    .from("product_dictionary")
    .select("*")
    .eq("user_id", user.id)
    .order("key", { ascending: true });

  if (error) throw error;
  // Migracao em memoria: garante que categorias legadas
  // (ex: "Laticinios") voltem com a grafia canonica (ex: "Laticinios").
  return ((data || []) as DictionaryEntry[]).map((entry) => ({
    ...entry,
    category: normalizeCategory(entry.category),
  }));
}

/**
 * Atualiza uma entrada do dicionário
 */
export async function updateDictionaryEntryInDB(
  key: string,
  normalizedName: string,
  category: string
): Promise<boolean> {
  const { client, user } = await getAuthenticatedSupabaseContext();

  const { error } = await client
    .from("product_dictionary")
    .update({
      normalized_name: normalizedName,
      category,
    })
    .eq("user_id", user.id)
    .eq("key", key);

  if (error) throw error;
  return true;
}

/**
 * Aplica uma entrada do dicionário aos itens salvos
 */
export async function applyDictionaryEntryToSavedItems(
  key: string,
  normalizedName: string | undefined,
  category: string | undefined
): Promise<{ updatedCount: number }> {
  const { client, user } = await getAuthenticatedSupabaseContext();

  if (!key) return { updatedCount: 0 };
  if (normalizedName === undefined && category === undefined) {
    return { updatedCount: 0 };
  }

  const { data, error } = await client.rpc("apply_dictionary_entry_to_items", {
    p_user_id: user.id,
    p_key: key,
    p_normalized_name: normalizedName ?? null,
    p_update_normalized_name: normalizedName !== undefined,
    p_category: category ?? null,
    p_update_category: category !== undefined,
  });

  if (error) throw mapSupabaseError(error, "applyDictionaryEntryToSavedItems");
  return { updatedCount: Number(data ?? 0) };
}

/**
 * Deleta uma entrada do dicionário
 */
export async function deleteDictionaryEntryFromDB(
  key: string
): Promise<boolean> {
  const { client, user } = await getAuthenticatedSupabaseContext();

  const { error } = await client
    .from("product_dictionary")
    .delete()
    .eq("user_id", user.id)
    .eq("key", key);

  if (error) throw error;
  return true;
}

/**
 * Limpa todo o dicionário do usuário
 */
export async function clearDictionaryInDB(): Promise<boolean> {
  const { client, user } = await getAuthenticatedSupabaseContext();

  const { error } = await client
    .from("product_dictionary")
    .delete()
    .eq("user_id", user.id);

  if (error) throw error;
  return true;
}

// =========================
// DICTIONARY BATCH OPERATIONS
// =========================

/**
 * Busca entradas do dicionário por chaves
 */
export async function getDictionary(keys: string[]): Promise<DictionaryMap> {
  if (!keys || keys.length === 0) return {};

  const { client, user } = await getAuthenticatedSupabaseContext();

  const { data, error } = await client
    .from("product_dictionary")
    .select("key, normalized_name, category")
    .eq("user_id", user.id)
    .in("key", keys);

  if (error) throw error;

  const rows = (data || []) as DbDictionaryRow[];
  return rows.reduce((acc: DictionaryMap, row) => {
    acc[row.key] = {
      normalized_name: row.normalized_name,
      category: normalizeCategory(row.category),
    };
    return acc;
  }, {});
}

/**
 * Atualiza múltiplas entradas do dicionário em batch
 */
export async function updateDictionary(
  entries: DictionaryUpdateEntry[]
): Promise<void> {
  if (!entries || entries.length === 0) return;

  const { client, user } = await getAuthenticatedSupabaseContext();

  const rows = entries.map((e) => ({
    user_id: user.id,
    key: e.key,
    normalized_name: e.normalized_name,
    category: normalizeCategory(e.category),
  }));

  const { error } = await client
    .from("product_dictionary")
    .upsert(rows, { onConflict: "user_id,key" });

  if (error) throw error;
}

