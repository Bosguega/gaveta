import { getAuthenticatedSupabaseContext } from "./authService";
import type { CanonicalProduct } from "../types/domain";
import {
  parseCreateCanonicalProductInput,
  parseUpdateCanonicalProductInput,
} from "../utils/validation/canonicalProduct";

// =========================
// CANONICAL PRODUCTS CRUD
// =========================

/**
 * Busca todos os produtos canônicos do usuário
 */
export async function getCanonicalProducts(): Promise<CanonicalProduct[]> {
  const { client, user } = await getAuthenticatedSupabaseContext();

  const { data, error } = await client
    .from("canonical_products")
    .select("*")
    .eq("user_id", user.id)
    .order("name", { ascending: true });

  if (error) throw error;
  return (data || []) as CanonicalProduct[];
}

/**
 * Busca um produto canônico por ID
 */
export async function getCanonicalProduct(
  id: string,
): Promise<CanonicalProduct | null> {
  const { client, user } = await getAuthenticatedSupabaseContext();

  const { data, error } = await client
    .from("canonical_products")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  return data as CanonicalProduct;
}

/**
 * Cria um novo produto canônico
 */
export async function createCanonicalProduct(
  product: Pick<CanonicalProduct, "slug" | "name" | "category" | "brand">,
): Promise<CanonicalProduct> {
  const { client, user } = await getAuthenticatedSupabaseContext();
  const validProduct = parseCreateCanonicalProductInput(product);

  const { data, error } = await client
    .from("canonical_products")
    .insert({
      ...validProduct,
      user_id: user.id,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error("Slug já existe. Use um slug diferente.");
    }
    throw error;
  }
  return data as CanonicalProduct;
}

/**
 * Atualiza um produto canônico existente
 */
export async function updateCanonicalProduct(
  id: string,
  updates: Partial<Pick<CanonicalProduct, "name" | "category" | "brand">>,
): Promise<void> {
  const { client, user } = await getAuthenticatedSupabaseContext();
  const validUpdates = parseUpdateCanonicalProductInput(updates);

  const { error } = await client
    .from("canonical_products")
    .update(validUpdates)
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw error;
}

/**
 * Deleta um produto canônico
 */
export async function deleteCanonicalProduct(id: string): Promise<void> {
  const { client, user } = await getAuthenticatedSupabaseContext();

  // Verificar se há itens associados do próprio usuário.
  const { data: receipts, error: receiptsError } = await client
    .from("receipts")
    .select("id")
    .eq("user_id", user.id);
  if (receiptsError) throw receiptsError;

  const receiptIds = (receipts || []).map((entry: { id: string }) => entry.id);
  if (receiptIds.length > 0) {
    const { count, error: countError } = await client
      .from("items")
      .select("*", { count: "exact", head: true })
      .in("receipt_id", receiptIds)
      .eq("canonical_product_id", id);
    if (countError) throw countError;

    if (count && count > 0) {
      throw new Error(
        `Não é possível deletar: existem ${count} itens associados a este produto.`,
      );
    }
  }

  const { error: dictionaryError } = await client
    .from("product_dictionary")
    .update({ canonical_product_id: null })
    .eq("user_id", user.id)
    .eq("canonical_product_id", id);
  if (dictionaryError) throw dictionaryError;

  const { error } = await client
    .from("canonical_products")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw error;
}

/**
 * Mescla dois produtos canônicos (secundário no primário)
 */
export async function mergeCanonicalProducts(
  primaryId: string,
  secondaryId: string,
): Promise<void> {
  const { client, user } = await getAuthenticatedSupabaseContext();

  const { error } = await client.rpc("merge_canonical_products_atomic", {
    p_primary_id: primaryId,
    p_secondary_id: secondaryId,
    p_user_id: user.id,
  });

  if (error) throw error;
}

/**
 * Limpa todos os produtos canÃ´nicos do usuÃ¡rio
 */
export async function clearCanonicalProductsInDB(): Promise<boolean> {
  const { client, user } = await getAuthenticatedSupabaseContext();

  const { data: receipts, error: receiptsError } = await client
    .from("receipts")
    .select("id")
    .eq("user_id", user.id);
  if (receiptsError) throw receiptsError;

  const receiptIds = (receipts || []).map((entry: { id: string }) => entry.id);
  if (receiptIds.length > 0) {
    const { error: itemsError } = await client
      .from("items")
      .update({ canonical_product_id: null })
      .in("receipt_id", receiptIds);
    if (itemsError) throw itemsError;
  }

  const { error: dictionaryError } = await client
    .from("product_dictionary")
    .update({ canonical_product_id: null })
    .eq("user_id", user.id);
  if (dictionaryError) throw dictionaryError;

  const { error } = await client
    .from("canonical_products")
    .delete()
    .eq("user_id", user.id);

  if (error) throw error;
  return true;
}

/**
 * Associa um item a um produto canônico
 */
export async function associateItemToCanonicalProduct(
  itemId: string,
  canonicalProductId: string | null,
): Promise<void> {
  const { client } = await getAuthenticatedSupabaseContext();

  const { error } = await client
    .from("items")
    .update({ canonical_product_id: canonicalProductId })
    .eq("id", itemId);

  if (error) throw error;
}
