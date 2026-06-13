import { getAuthenticatedSupabaseContext } from "./authService";
import type { EstablishmentDictionaryEntry, EstablishmentDictionaryMap } from "../types/domain";
import { mapSupabaseError } from "../utils/supabaseError";
import { normalizeKey } from "../utils/normalize";

// =========================
// ESTABLISHMENT DICTIONARY CRUD
// =========================

/**
 * Busca todas as entradas do dicionário de estabelecimentos
 */
export async function getFullEstablishmentDictionaryFromDB(): Promise<EstablishmentDictionaryEntry[]> {
    const { client, user } = await getAuthenticatedSupabaseContext();

    const { data, error } = await client
        .from("establishment_dictionary")
        .select("*")
        .eq("user_id", user.id)
        .order("establishment", { ascending: true });

    if (error) throw error;
    return (data || []) as EstablishmentDictionaryEntry[];
}

/**
 * Busca o mapa establishment → nome_fantasia (para uso na UI)
 */
export async function getEstablishmentMapFromDB(): Promise<EstablishmentDictionaryMap> {
    const entries = await getFullEstablishmentDictionaryFromDB();
    return entries.reduce<EstablishmentDictionaryMap>((acc, entry) => {
        const key = normalizeKey(entry.establishment);
        acc[key] = entry.nome_fantasia;
        return acc;
    }, {});
}

/**
 * Atualiza ou insere uma entrada no dicionário de estabelecimentos
 */
export async function upsertEstablishmentDictionaryEntryInDB(
    establishment: string,
    nomeFantasia: string
): Promise<boolean> {
    const { client, user } = await getAuthenticatedSupabaseContext();

    const { error } = await client
        .from("establishment_dictionary")
        .upsert(
            {
                establishment: establishment,
                nome_fantasia: nomeFantasia,
                user_id: user.id,
            },
            { onConflict: "user_id,establishment" }
        );

    if (error) throw error;
    return true;
}

/**
 * Aplica uma entrada do dicionário às receipts salvas.
 * Atualiza APENAS a coluna establishment_display, preservando o original.
 */
export async function applyEstablishmentEntryToSavedReceipts(
    oldName: string,
    newName: string
): Promise<{ updatedCount: number }> {
    const { client, user } = await getAuthenticatedSupabaseContext();

    const { data, error } = await client.rpc("apply_establishment_entry_to_receipts", {
        p_user_id: user.id,
        p_old_name: oldName,
        p_new_name: newName,
    });

    if (error) throw mapSupabaseError(error, "applyEstablishmentEntryToSavedReceipts");
    return { updatedCount: Number(data ?? 0) };
}

/**
 * Deleta uma entrada do dicionário de estabelecimentos
 */
export async function deleteEstablishmentDictionaryEntryFromDB(
    establishment: string
): Promise<boolean> {
    const { client, user } = await getAuthenticatedSupabaseContext();

    const { error } = await client
        .from("establishment_dictionary")
        .delete()
        .eq("user_id", user.id)
        .eq("establishment", establishment);

    if (error) throw error;
    return true;
}

/**
 * Limpa todo o dicionário de estabelecimentos do usuário
 */
export async function clearEstablishmentDictionaryInDB(): Promise<boolean> {
    const { client, user } = await getAuthenticatedSupabaseContext();

    const { error } = await client
        .from("establishment_dictionary")
        .delete()
        .eq("user_id", user.id);

    if (error) throw error;
    return true;
}