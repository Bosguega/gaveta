import { supabase, isSupabaseConfigured } from "./supabaseClient";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SharedList {
    id: string;
    code: string;
    name: string;
    owner_id: string;
    created_at: string;
    updated_at: string;
}

export interface SharedListItem {
    id: string;
    list_id: string;
    name: string;
    normalized_key: string;
    quantity?: string;
    note?: string;
    checked: boolean;
    checked_at?: string | null;
    created_at: string;
    updated_at: string;
}

export type PublishListInput = {
    ownerId: string;
    name: string;
    items: Array<{
        name: string;
        normalized_key: string;
        quantity?: string;
        note?: string;
    }>;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function requireConfig() {
    if (!isSupabaseConfigured || !supabase) {
        throw new Error("Supabase não configurado.");
    }
    return supabase;
}

/**
 * Gera código alfanumérico de 6 caracteres para compartilhamento.
 */
function generateShareCode(): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sem I, O, 0, 1 para evitar confusão
    let code = "";
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

/**
 * Normaliza o nome de um item para chave de comparação.
 */
function normalizeKey(name: string): string {
    return name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/g, "");
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Busca uma lista compartilhada e seus itens pelo código.
 * Não requer autenticação — qualquer pessoa com o código pode acessar.
 */
export async function getSharedList(
    code: string,
): Promise<{ list: SharedList; items: SharedListItem[] } | null> {
    const client = requireConfig();
    const normalizedCode = code.trim().toUpperCase();

    const { data: list, error: listError } = await client
        .from("collaborative_lists")
        .select("id, code, name, owner_id, created_at, updated_at")
        .eq("code", normalizedCode)
        .maybeSingle();

    if (listError || !list) {
        return null;
    }

    const { data: items, error: itemsError } = await client
        .from("collaborative_list_items")
        .select("id, list_id, name, normalized_key, quantity, note, checked, checked_at, created_at, updated_at")
        .eq("list_id", list.id)
        .order("created_at", { ascending: true });

    if (itemsError) {
        return null;
    }

    return {
        list: {
            id: list.id,
            code: list.code,
            name: list.name,
            owner_id: list.owner_id,
            created_at: list.created_at,
            updated_at: list.updated_at,
        },
        items: (items || []).map((item) => ({
            id: item.id,
            list_id: item.list_id,
            name: item.name,
            normalized_key: item.normalized_key,
            quantity: item.quantity ?? undefined,
            note: item.note ?? undefined,
            checked: item.checked,
            checked_at: item.checked_at,
            created_at: item.created_at,
            updated_at: item.updated_at,
        })),
    };
}

/**
 * Publica uma lista como compartilhada.
 * Cria registro na tabela collaborative_lists e copia os itens.
 * Retorna o código gerado.
 */
export async function publishList(
    input: PublishListInput,
): Promise<{ code: string }> {
    const client = requireConfig();

    // Gera um código único (tenta até 5x se houver colisão)
    let code = generateShareCode();
    for (let attempt = 0; attempt < 5; attempt++) {
        const { data: existing } = await client
            .from("collaborative_lists")
            .select("id")
            .eq("code", code)
            .maybeSingle();

        if (!existing) break;
        code = generateShareCode();
    }

    const now = new Date().toISOString();

    // Cria a lista
    const { data: list, error: listError } = await client
        .from("collaborative_lists")
        .insert({
            code,
            name: input.name.trim(),
            owner_id: input.ownerId,
            created_at: now,
            updated_at: now,
        })
        .select("id")
        .single();

    if (listError) throw new Error(`Erro ao criar lista compartilhada: ${listError.message}`);
    if (!list) throw new Error("Erro ao criar lista compartilhada: nenhum retorno.");

    // Copia os itens
    if (input.items.length > 0) {
        const itemsToInsert = input.items.map((item) => ({
            list_id: list.id,
            name: item.name.trim(),
            normalized_key: item.normalized_key,
            quantity: item.quantity?.trim() || null,
            note: item.note?.trim().slice(0, 200) || null,
            checked: false,
            created_at: now,
            updated_at: now,
        }));

        const { error: itemsError } = await client
            .from("collaborative_list_items")
            .insert(itemsToInsert);

        if (itemsError) {
            // Se falhar ao inserir itens, tenta limpar a lista criada
            await client.from("collaborative_lists").delete().eq("id", list.id);
            throw new Error(`Erro ao copiar itens: ${itemsError.message}`);
        }
    }

    return { code };
}

/**
 * Remove o compartilhamento de uma lista (apenas o dono pode).
 */
export async function unpublishList(
    code: string,
    ownerId: string,
): Promise<void> {
    const client = requireConfig();
    const normalizedCode = code.trim().toUpperCase();

    const { data: list, error: findError } = await client
        .from("collaborative_lists")
        .select("id, owner_id")
        .eq("code", normalizedCode)
        .single();

    if (findError || !list) {
        throw new Error("Lista compartilhada não encontrada.");
    }

    if (list.owner_id !== ownerId) {
        throw new Error("Apenas o dono pode remover o compartilhamento.");
    }

    // Deleta itens primeiro (FK constraint)
    await client.from("collaborative_list_items").delete().eq("list_id", list.id);
    await client.from("collaborative_lists").delete().eq("id", list.id);
}

/**
 * Alterna o estado checked de um item na lista compartilhada.
 * Qualquer pessoa com o código pode alternar (última escrita vence).
 */
export async function toggleSharedItem(
    itemId: string,
    checked: boolean,
): Promise<boolean> {
    const client = requireConfig();
    const now = new Date().toISOString();

    const patch: Record<string, string | boolean | null> = {
        checked,
        updated_at: now,
    };

    if (checked) {
        patch.checked_at = now;
    } else {
        patch.checked_at = null;
    }

    const { error: updateError } = await client
        .from("collaborative_list_items")
        .update(patch)
        .eq("id", itemId);

    if (updateError) {
        return false;
    }

    return true;
}

/**
 * Adiciona um item à lista compartilhada.
 * Qualquer pessoa com o código pode adicionar.
 */
export async function addSharedItem(
    listCode: string,
    name: string,
    quantity?: string,
    note?: string,
): Promise<SharedListItem | null> {
    const client = requireConfig();
    const normalizedCode = listCode.trim().toUpperCase();
    const trimmedName = name.trim();

    if (!trimmedName) return null;

    const { data: list, error: listError } = await client
        .from("collaborative_lists")
        .select("id")
        .eq("code", normalizedCode)
        .single();

    if (listError || !list) return null;

    const now = new Date().toISOString();
    const normalizedKey = normalizeKey(trimmedName);

    const { data: item, error: itemError } = await client
        .from("collaborative_list_items")
        .insert({
            list_id: list.id,
            name: trimmedName,
            normalized_key: normalizedKey,
            quantity: quantity?.trim() || null,
            note: note?.trim().slice(0, 200) || null,
            checked: false,
            created_at: now,
            updated_at: now,
        })
        .select()
        .single();

    if (itemError || !item) return null;

    return {
        id: item.id,
        list_id: item.list_id,
        name: item.name,
        normalized_key: item.normalized_key,
        quantity: item.quantity ?? undefined,
        note: item.note ?? undefined,
        checked: item.checked,
        checked_at: item.checked_at,
        created_at: item.created_at,
        updated_at: item.updated_at,
    };
}

/**
 * Remove um item da lista compartilhada.
 */
export async function removeSharedItem(
    itemId: string,
    listCode: string,
): Promise<boolean> {
    const client = requireConfig();

    // Verifica se o item pertence à lista com este código
    const { data: item } = await client
        .from("collaborative_list_items")
        .select("list_id")
        .eq("id", itemId)
        .single();

    if (!item) return false;

    const { data: list } = await client
        .from("collaborative_lists")
        .select("id")
        .eq("id", item.list_id)
        .eq("code", listCode)
        .single();

    if (!list) return false;

    const { error } = await client
        .from("collaborative_list_items")
        .delete()
        .eq("id", itemId);

    return !error;
}

/**
 * Atualiza os itens de uma lista compartilhada com os itens atuais do dono.
 * Estratégia: deleta todos os itens existentes e reinsere (simples e seguro).
 * O dono precisa fornecer o código e seu ownerId para confirmar.
 */
export async function updateSharedListItems(
    code: string,
    ownerId: string,
    items: Array<{
        name: string;
        normalized_key: string;
        quantity?: string;
        note?: string;
    }>,
): Promise<void> {
    const client = requireConfig();
    const normalizedCode = code.trim().toUpperCase();

    const { data: list, error: findError } = await client
        .from("collaborative_lists")
        .select("id, owner_id")
        .eq("code", normalizedCode)
        .single();

    if (findError || !list) {
        throw new Error("Lista compartilhada não encontrada.");
    }

    if (list.owner_id !== ownerId) {
        throw new Error("Apenas o dono pode atualizar a lista compartilhada.");
    }

    // Deleta itens existentes
    await client.from("collaborative_list_items").delete().eq("list_id", list.id);

    // Reinsere itens atuais
    if (items.length > 0) {
        const now = new Date().toISOString();
        const itemsToInsert = items.map((item) => ({
            list_id: list.id,
            name: item.name.trim(),
            normalized_key: item.normalized_key,
            quantity: item.quantity?.trim() || null,
            note: item.note?.trim().slice(0, 200) || null,
            checked: false,
            created_at: now,
            updated_at: now,
        }));

        const { error: itemsError } = await client
            .from("collaborative_list_items")
            .insert(itemsToInsert);

        if (itemsError) {
            throw new Error(`Erro ao atualizar itens: ${itemsError.message}`);
        }
    }
}

/**
 * Retorna o código de compartilhamento de uma lista pelo ID do dono.
 * Útil para verificar se uma lista já está compartilhada.
 */
export async function getShareCodeByOwnerId(
    ownerId: string,
    listName: string,
): Promise<string | null> {
    const client = requireConfig();

    const { data: list } = await client
        .from("collaborative_lists")
        .select("code")
        .eq("owner_id", ownerId)
        .eq("name", listName.trim())
        .maybeSingle();

    return list?.code ?? null;
}

/**
 * Lista todas as listas compartilhadas por um usuário (dono).
 */
export async function getSharedListsByOwner(
    ownerId: string,
): Promise<SharedList[]> {
    const client = requireConfig();

    const { data, error } = await client
        .from("collaborative_lists")
        .select("id, code, name, owner_id, created_at, updated_at")
        .eq("owner_id", ownerId)
        .order("updated_at", { ascending: false });

    if (error) return [];
    return data ?? [];
}