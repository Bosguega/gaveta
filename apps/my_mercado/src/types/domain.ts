export interface SessionUser {
  id: string;
  email?: string | null;
}

/**
 * Item de receipt no formato RAW (output do parser)
 * Todos os valores numéricos são strings no formato brasileiro
 */
export interface RawReceiptItem {
  name: string;
  qty: string;
  unit: string;
  unitPrice: string;
  total: string;
}

/**
 * Item de receipt processado (formato DB/estado da aplicação)
 * Valores numéricos normalizados como numbers
 */
export interface ReceiptItem {
  id?: string;
  name: string;
  normalized_key?: string;
  normalized_name?: string;
  category?: string;
  canonical_product_id?: string;
  quantity: number;
  unit?: string;
  price: number;
  total?: number;
}

/**
 * Receipt (nota fiscal)
 */
export interface Receipt {
  id: string;
  establishment: string;
  date: string;
  items: ReceiptItem[];
  created_at?: string;
}

/**
 * Entrada do dicionário de produtos
 */
export interface DictionaryEntry {
  key: string;
  normalized_name: string;
  category?: string;
  canonical_product_id?: string;
  user_id?: string;
  created_at?: string;
}

/**
 * Mapa do dicionário de produtos (key → dados)
 */
export type DictionaryMap = Record<
  string,
  {
    normalized_name?: string;
    category?: string;
    canonical_product_id?: string;
  }
>;

/**
 * Produto canônico (agrupa variações do mesmo produto)
 */
export interface CanonicalProduct {
  id: string;
  slug: string;
  name: string;
  category?: string;
  brand?: string;
  user_id?: string;
  merge_count?: number;
  created_at?: string;
  updated_at?: string;
}

export type ShoppingListMemberRole = "owner" | "editor" | "viewer";

export interface CollaborativeShoppingList {
  id: string;
  owner_user_id: string;
  name: string;
  share_code: string;
  created_at: string;
  updated_at: string;
  role?: ShoppingListMemberRole;
}

export interface CollaborativeShoppingListItem {
  id: string;
  list_id: string;
  name: string;
  normalized_key: string;
  quantity?: string;
  checked: boolean;
  checked_at?: string | null;
  checked_by_user_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CollaborativeShoppingListMember {
  list_id: string;
  user_id: string;
  role: ShoppingListMemberRole;
  created_at: string;
}
