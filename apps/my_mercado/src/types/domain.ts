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
  /**
   * Preço unitário efetivamente pago (após desconto por item), em formato BR.
   * Opcional: só a extração via galeria (IA) o preenche. Os demais fluxos
   * deixam este campo ausente, preservando o comportamento atual.
   */
  paidPrice?: string;
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
  quantity: number;
  unit?: string;
  price: number;
  paid_price?: number;
  total?: number;
}

/**
 * Origem da extração de uma nota. Usado apenas no fluxo do scanner (estado
 * em memória) para habilitar recursos específicos — ex.: edição completa de
 * itens na galeria. Não é persistido no banco nem no backup.
 */
export type ReceiptSource = "qr" | "gallery" | "text" | "manual";

/**
 * Receipt (nota fiscal)
 */
export interface Receipt {
  id: string;
  establishment: string;
  establishment_display?: string;
  date: string;
  items: ReceiptItem[];
  created_at?: string;
  total_discount?: number;
  nfce_qr_url?: string;
  /** Discriminador explícito da origem da extração (não persistido). */
  source?: ReceiptSource;
}

/**
 * Entrada do dicionário de produtos
 */
export interface DictionaryEntry {
  key: string;
  normalized_name: string;
  category?: string;
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
  }
>;

/**
 * Entrada do dicionário de estabelecimentos
 */
export interface EstablishmentDictionaryEntry {
  establishment: string;
  nome_fantasia: string;
  user_id?: string;
  created_at?: string;
}

/**
 * Mapa do dicionário de estabelecimentos (establishment → nome_fantasia)
 */
export type EstablishmentDictionaryMap = Record<string, string>;


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
  note?: string;
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
