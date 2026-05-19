import { useState, useEffect, useRef, useCallback } from "react";
import {
    getSharedList,
    toggleSharedItem,
    addSharedItem,
    removeSharedItem,
} from "../../services/sharedListService";
import type { SharedList, SharedListItem } from "../../services/sharedListService";

export type UseSharedListResult = {
    list: SharedList | null;
    items: SharedListItem[];
    loading: boolean;
    error: string | null;
    toggleItem: (itemId: string, checked: boolean) => Promise<void>;
    addItem: (name: string, quantity?: string, note?: string) => Promise<boolean>;
    removeItem: (itemId: string) => Promise<void>;
};

const POLL_INTERVAL_MS = 5000;

/**
 * Hook para acessar e manipular uma lista compartilhada por código.
 * Polling a cada 5s para sincronizar alterações.
 * Sem dependência de auth, stores ou providers do app principal.
 */
export function useSharedList(code: string): UseSharedListResult {
    const [list, setList] = useState<SharedList | null>(null);
    const [items, setItems] = useState<SharedListItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const mountedRef = useRef(true);

    const fetchList = useCallback(async () => {
        if (!code) return;

        try {
            const result = await getSharedList(code);
            if (!result) {
                if (mountedRef.current) {
                    setList(null);
                    setItems([]);
                    setError("Lista não encontrada.");
                }
                return;
            }

            if (mountedRef.current) {
                setList(result.list);
                setItems(result.items);
                setError(null);
            }
        } catch {
            if (mountedRef.current) {
                setError("Erro ao carregar lista.");
            }
        } finally {
            if (mountedRef.current) {
                setLoading(false);
            }
        }
    }, [code]);

    // Fetch inicial + polling
    useEffect(() => {
        mountedRef.current = true;
        setLoading(true);

        fetchList();

        pollingRef.current = setInterval(fetchList, POLL_INTERVAL_MS);

        return () => {
            mountedRef.current = false;
            if (pollingRef.current) {
                clearInterval(pollingRef.current);
                pollingRef.current = null;
            }
        };
    }, [fetchList]);

    const toggleItem = useCallback(
        async (itemId: string, checked: boolean) => {
            if (!code) return;

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

            await toggleSharedItem(itemId, code, checked);
        },
        [code],
    );

    const addItemFn = useCallback(
        async (name: string, quantity?: string, note?: string): Promise<boolean> => {
            if (!code || !name.trim()) return false;

            const newItem = await addSharedItem(code, name, quantity, note);
            if (!newItem) return false;

            setItems((prev) => [...prev, newItem]);
            return true;
        },
        [code],
    );

    const removeItemFn = useCallback(
        async (itemId: string) => {
            if (!code) return;

            // Optimistic remove
            setItems((prev) => prev.filter((item) => item.id !== itemId));

            await removeSharedItem(itemId, code);
        },
        [code],
    );

    return {
        list,
        items,
        loading,
        error,
        toggleItem,
        addItem: addItemFn,
        removeItem: removeItemFn,
    };
}
