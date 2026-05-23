import { useState, useEffect, useRef, useCallback } from "react";
import {
    getSharedList,
    toggleSharedItem,
    addSharedItem,
    removeSharedItem,
} from "../../services/sharedListService";
import { supabase } from "../../services/supabaseClient";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { SharedList, SharedListItem } from "../../services/sharedListService";

export type UseSharedListResult = {
    list: SharedList | null;
    items: SharedListItem[];
    loading: boolean;
    error: string | null;
    toggleItem: (itemId: string, checked: boolean) => Promise<void>;
    addItem: (name: string, quantity?: string, note?: string) => Promise<boolean>;
    removeItem: (itemId: string) => Promise<void>;
    refresh: () => Promise<void>;
};

const FALLBACK_POLL_INTERVAL_MS = 30_000;

/**
 * Hook para acessar e manipular uma lista compartilhada por código.
 *
 * Sincronização:
 *   - Usa Realtime subscriptions do Supabase para atualizações instantâneas
 *     (inscrito no canal `collaborative_list_items` filtrado pelo list_id).
 *   - Fallback polling a cada 30s caso a subscription não entregue eventos.
 *   - Mutations (toggle/add/remove) via REST com optimistic update.
 *
 * Sem dependência de auth, stores ou providers do app principal.
 */
export function useSharedList(code: string): UseSharedListResult {
    const [list, setList] = useState<SharedList | null>(null);
    const [items, setItems] = useState<SharedListItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [listId, setListId] = useState<string | null>(null);
    const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const channelRef = useRef<RealtimeChannel | null>(null);
    const mountedRef = useRef(true);

    // -------------------------------------------------------------------
    // Função para inscrever/inscrever no Realtime
    // -------------------------------------------------------------------
    const subscribeToRealtime = useCallback((currentListId: string) => {
        if (!supabase) return;

        // Remove canal anterior se existir
        if (channelRef.current) {
            supabase.removeChannel(channelRef.current);
            channelRef.current = null;
        }

        const channel = supabase
            .channel(`shared-list-${currentListId}`)
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "collaborative_list_items",
                    filter: `list_id=eq.${currentListId}`,
                },
                (payload) => {
                    if (!mountedRef.current) return;

                    const newItem = payload.new as Record<string, unknown> | null;
                    const oldItem = payload.old as Record<string, unknown> | null;

                    setItems((prev) => {
                        switch (payload.eventType) {
                            case "INSERT":
                                if (!newItem) return prev;
                                // Evita duplicata se optimistic update já inseriu
                                if (prev.some((i) => i.id === newItem.id)) return prev;
                                return [...prev, mapRowToItem(newItem)];
                            case "UPDATE":
                                if (!newItem) return prev;
                                return prev.map((i) =>
                                    i.id === newItem.id ? mapRowToItem(newItem) : i,
                                );
                            case "DELETE":
                                if (!oldItem) return prev;
                                return prev.filter((i) => i.id !== oldItem.id);
                            default:
                                return prev;
                        }
                    });
                },
            )
            .subscribe((status, err) => {
                console.log(`[Realtime Status] channel: shared-list-${currentListId}, status: ${status}`, err);
            });

        channelRef.current = channel;
    }, []);

    // -------------------------------------------------------------------
    // Fetch da lista (obtém list + items do servidor)
    // -------------------------------------------------------------------
    const fetchList = useCallback(async () => {
        if (!code) return;

        try {
            console.log(`[useSharedList.fetchList] Buscando lista compartilhada para o código: ${code}...`);
            const result = await getSharedList(code);
            if (!result) {
                console.warn(`[useSharedList.fetchList] Lista não encontrada para o código: ${code}`);
                if (mountedRef.current) {
                    setList(null);
                    setItems([]);
                    setListId(null);
                    setError("Lista não encontrada.");
                }
                return;
            }

            console.log(`[useSharedList.fetchList] Sucesso! Itens recebidos:`, 
                result.items.map(i => ({ id: i.id, name: i.name, checked: i.checked, updated_at: i.updated_at }))
            );

            if (mountedRef.current) {
                setList(result.list);
                setItems(result.items);
                setListId(result.list.id);
                setError(null);
            }
        } catch (err) {
            console.error(`[useSharedList.fetchList] Erro ao carregar lista:`, err);
            if (mountedRef.current) {
                setError("Erro ao carregar lista.");
            }
        } finally {
            if (mountedRef.current) {
                setLoading(false);
            }
        }
    }, [code]);

    // -------------------------------------------------------------------
    // Setup: fetch inicial + Realtime subscription + fallback polling
    // -------------------------------------------------------------------
    useEffect(() => {
        mountedRef.current = true;
        setLoading(true);

        fetchList();

        // Fallback polling (a cada 30s)
        pollingRef.current = setInterval(fetchList, FALLBACK_POLL_INTERVAL_MS);

        return () => {
            mountedRef.current = false;

            if (pollingRef.current) {
                clearInterval(pollingRef.current);
                pollingRef.current = null;
            }

            if (supabase && channelRef.current) {
                supabase.removeChannel(channelRef.current);
                channelRef.current = null;
            }
        };
    }, [fetchList, code]);

    // -------------------------------------------------------------------
    // Re-inscrever no Realtime quando listId mudar
    // -------------------------------------------------------------------
    useEffect(() => {
        if (listId) {
            subscribeToRealtime(listId);
        }

        return () => {
            if (supabase && channelRef.current) {
                supabase.removeChannel(channelRef.current);
                channelRef.current = null;
            }
        };
    }, [listId, subscribeToRealtime]);

    // -------------------------------------------------------------------
    // Mutations (com optimistic update + rollback on error)
    // -------------------------------------------------------------------
    const toggleItem = useCallback(
        async (itemId: string, checked: boolean) => {
            if (!code) return;

            const previousItems = items;

            // Optimistic update
            setItems((prev) =>
                prev.map((item) =>
                    item.id === itemId
                        ? {
                            ...item,
                            checked,
                            checked_at: checked ? new Date().toISOString() : null,
                            updated_at: new Date().toISOString(),
                        }
                        : item,
                ),
            );

            const success = await toggleSharedItem(itemId, checked);
            if (!success && mountedRef.current) {
                // Rollback
                setItems(previousItems);
            }
        },
        [items],
    );

    const addItemFn = useCallback(
        async (name: string, quantity?: string, note?: string): Promise<boolean> => {
            if (!code || !name.trim()) return false;

            const newItem = await addSharedItem(code, name, quantity, note);
            if (!newItem) return false;

            // Adiciona ao estado local (Realtime vai entregar o mesmo evento,
            // mas evitamos duplicata no handler do Realtime)
            setItems((prev) => [...prev, newItem]);
            return true;
        },
        [code],
    );

    const removeItemFn = useCallback(
        async (itemId: string) => {
            if (!code) return;

            const previousItems = items;

            // Optimistic remove
            setItems((prev) => prev.filter((item) => item.id !== itemId));

            const success = await removeSharedItem(itemId, code);
            if (!success && mountedRef.current) {
                // Rollback
                setItems(previousItems);
            }
        },
        [code, items],
    );

    const refresh = useCallback(async () => {
        setLoading(true);
        await fetchList();
    }, [fetchList]);

    return {
        list,
        items,
        loading,
        error,
        toggleItem,
        addItem: addItemFn,
        removeItem: removeItemFn,
        refresh,
    };
}

// -------------------------------------------------------------------
// Helper: converte row do Supabase para SharedListItem
// -------------------------------------------------------------------
function mapRowToItem(row: Record<string, unknown>): SharedListItem {
    return {
        id: row.id as string,
        list_id: row.list_id as string,
        name: row.name as string,
        normalized_key: (row.normalized_key as string) ?? "",
        quantity: (row.quantity as string) ?? undefined,
        note: (row.note as string) ?? undefined,
        checked: Boolean(row.checked),
        checked_at: (row.checked_at as string) ?? null,
        created_at: row.created_at as string,
        updated_at: row.updated_at as string,
    };
}