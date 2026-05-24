import { useEffect, useState, useCallback } from "react";
import { supabase, isSupabaseConfigured } from "../services/supabaseClient";
import { getSharedList, toggleSharedItem } from "../services/sharedListService";
import type { SharedList as SharedListType, SharedListItem as SharedListItemType } from "../services/sharedListService";
import "./shared.css";

type Props = {
    code: string;
};

/**
 * Separa o note em anotação manual (antes de "Últimas:") e histórico (depois).
 * Formato esperado: "Obs manual\n\nÚltimas:\n12/05 R$25,90 (Mercado)"
 */
function parseNote(note: string | undefined): { annotation?: string; historyLines: string[] } {
    if (!note) return { historyLines: [] };

    const idx = note.indexOf("\n\nÚltimas:");
    if (idx === -1) return { annotation: note, historyLines: [] };

    const annotation = note.slice(0, idx).trim() || undefined;
    const historyPart = note.slice(idx + 11).trim(); // pula "\n\nÚltimas:"
    const lines = historyPart
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);

    return { annotation, historyLines: lines };
}

export function SharedApp({ code }: Props) {
    const [list, setList] = useState<SharedListType | null>(null);
    const [items, setItems] = useState<SharedListItemType[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expandedHistory, setExpandedHistory] = useState<Set<string>>(new Set());

    // Carrega dados iniciais
    useEffect(() => {
        (async () => {
            try {
                const data = await getSharedList(code);
                if (!data) {
                    setError("Lista não encontrada ou código inválido.");
                    return;
                }
                setList(data.list);
                setItems(data.items);
            } catch {
                setError("Erro ao carregar a lista.");
            } finally {
                setLoading(false);
            }
        })();
    }, [code]);

    // Realtime subscription para atualização entre dispositivos
    useEffect(() => {
        if (!isSupabaseConfigured || !supabase) return;

        let channel: ReturnType<typeof supabase.channel> | null = null;

        getSharedList(code).then((data) => {
            if (!data) return;

            const listId = data.list.id;
            const client = supabase!;

            channel = client
                .channel(`shared-list-${listId}`)
                .on(
                    "postgres_changes",
                    {
                        event: "*",
                        schema: "public",
                        table: "collaborative_list_items",
                        filter: `list_id=eq.${listId}`,
                    },
                    (payload) => {
                        if (payload.eventType === "UPDATE") {
                            const updated = payload.new as Record<string, unknown>;
                            setItems((prev) =>
                                prev.map((item) =>
                                    item.id === updated.id
                                        ? {
                                            id: String(updated.id),
                                            list_id: String(updated.list_id),
                                            name: String(updated.name),
                                            normalized_name: String(updated.normalized_name || ""),
                                            quantity: updated.quantity ? String(updated.quantity) : undefined,
                                            note: updated.note ? String(updated.note) : undefined,
                                            checked: Boolean(updated.checked),
                                            checked_at: updated.checked_at ? String(updated.checked_at) : null,
                                            created_at: String(updated.created_at),
                                            updated_at: String(updated.updated_at),
                                        }
                                        : item,
                                ),
                            );
                        }
                    },
                )
                .subscribe();
        });

        return () => {
            if (channel) {
                supabase?.removeChannel(channel);
            }
        };
    }, [code]);

    const handleToggle = useCallback(async (itemId: string, checked: boolean) => {
        // Otimista
        setItems((prev) =>
            prev.map((item) =>
                item.id === itemId ? { ...item, checked: !checked } : item,
            ),
        );

        const success = await toggleSharedItem(itemId, !checked);
        if (!success) {
            setItems((prev) =>
                prev.map((item) =>
                    item.id === itemId ? { ...item, checked } : item,
                ),
            );
        }
    }, []);

    const toggleHistory = useCallback((itemId: string) => {
        setExpandedHistory((prev) => {
            const next = new Set(prev);
            if (next.has(itemId)) {
                next.delete(itemId);
            } else {
                next.add(itemId);
            }
            return next;
        });
    }, []);

    if (loading) {
        return (
            <div className="shared-container">
                <div className="shared-card">
                    <p className="shared-loading">Carregando lista...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="shared-container">
                <div className="shared-card">
                    <h1 className="shared-title">Lista de Compras</h1>
                    <p className="shared-error">{error}</p>
                </div>
            </div>
        );
    }

    const checkedCount = items.filter((i) => i.checked).length;

    return (
        <div className="shared-container">
            <div className="shared-card">
                <h1 className="shared-title">{list?.name || "Lista de Compras"}</h1>

                <div className="shared-progress">
                    <span>{checkedCount}/{items.length} itens</span>
                    <div className="shared-progress-bar">
                        <div
                            className="shared-progress-fill"
                            style={{ width: items.length > 0 ? `${(checkedCount / items.length) * 100}%` : "0%" }}
                        />
                    </div>
                </div>

                <ul className="shared-items">
                    {items.map((item) => {
                        const { annotation, historyLines } = parseNote(item.note);
                        const isHistoryExpanded = expandedHistory.has(item.id);

                        return (
                            <li key={item.id} className="shared-item">
                                <label className="shared-label">
                                    <input
                                        type="checkbox"
                                        checked={item.checked}
                                        onChange={() => handleToggle(item.id, item.checked)}
                                        className="shared-checkbox"
                                    />
                                    <span className={item.checked ? "shared-name checked" : "shared-name"}>
                                        {item.name}
                                    </span>
                                </label>

                                {item.quantity && (
                                    <span className="shared-qty">{item.quantity}</span>
                                )}

                                {/* Anotação manual — sempre visível */}
                                {annotation && (
                                    <p className="shared-annotation">{annotation}</p>
                                )}

                                {/* Histórico de compras — collapsible */}
                                {historyLines.length > 0 && (
                                    <div className="shared-history">
                                        <button
                                            className="shared-history-toggle"
                                            onClick={() => toggleHistory(item.id)}
                                        >
                                            <span className={isHistoryExpanded ? "arrow expanded" : "arrow"}>▶</span>
                                            Últimas compras
                                        </button>
                                        {isHistoryExpanded && (
                                            <div className="shared-history-lines">
                                                {historyLines.map((line, i) => (
                                                    <p key={i} className="shared-history-line">{line}</p>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </li>
                        );
                    })}
                </ul>

                {items.length === 0 && (
                    <p className="shared-empty">Nenhum item nesta lista.</p>
                )}

                <p className="shared-footer">
                    Criada por compartilhamento via código <strong>{code}</strong>
                </p>
            </div>
        </div>
    );
}