import { Tag, Merge, Edit3, Trash2 } from "lucide-react";
import type { CanonicalProduct, DictionaryEntry } from "../../types/domain";

interface CanonicalProductItemProps {
    product: CanonicalProduct;
    aliases: DictionaryEntry[];
    isMergeMode: boolean;
    isPrimaryMerge: boolean;
    onEdit: () => void;
    onDelete: () => void;
    onStartMerge: () => void;
    onMerge: () => void;
}

/**
 * Item individual de produto canônico na lista
 */
export function CanonicalProductItem({
    product,
    aliases,
    isMergeMode,
    isPrimaryMerge,
    onEdit,
    onDelete,
    onStartMerge,
    onMerge,
}: CanonicalProductItemProps) {
    return (
        <div
            className="glass-card animated-item"
            style={{
                padding: "1.25rem",
                border: isMergeMode && !isPrimaryMerge
                    ? "1px solid rgba(245, 158, 11, 0.3)"
                    : undefined,
            }}
        >
            {/* Modo visualização */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                        <span style={{ color: "#fff", fontWeight: 600, fontSize: "1rem" }}>
                            {product.name}
                        </span>
                        {product.category && (
                            <span
                                style={{
                                    fontSize: "0.65rem",
                                    background: "rgba(59, 130, 246, 0.1)",
                                    padding: "2px 6px",
                                    borderRadius: "4px",
                                    color: "var(--primary)",
                                }}
                            >
                                {product.category}
                            </span>
                        )}
                        {product.brand && (
                            <span
                                style={{
                                    fontSize: "0.65rem",
                                    background: "rgba(16, 185, 129, 0.1)",
                                    padding: "2px 6px",
                                    borderRadius: "4px",
                                    color: "#10b981",
                                }}
                            >
                                {product.brand}
                            </span>
                        )}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#64748b", fontStyle: "italic", marginBottom: "4px" }}>
                        Slug: {product.slug}
                        {product.merge_count && product.merge_count > 1 && (
                            <span style={{ marginLeft: "8px", color: "#f59e0b" }}>
                                ({product.merge_count} merges)
                            </span>
                        )}
                    </div>

                    {/* Apelidos do Dicionário */}
                    {aliases.length > 0 && (
                        <div style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: "4px",
                            marginTop: "8px",
                            padding: "4px 8px",
                            background: "rgba(255,255,255,0.03)",
                            borderRadius: "8px",
                            border: "1px solid rgba(255,255,255,0.05)"
                        }}>
                            <span style={{ fontSize: "0.7rem", color: "#94a3b8", display: "flex", alignItems: "center", gap: "4px", marginRight: "4px" }}>
                                <Tag size={10} /> Reconhecido como:
                            </span>
                            {aliases.slice(0, 10).map(a => (
                                <span key={a.key} style={{
                                    fontSize: "0.7rem",
                                    color: "#e2e8f0",
                                    background: "rgba(255,255,255,0.05)",
                                    padding: "1px 6px",
                                    borderRadius: "4px"
                                }}>
                                    {a.normalized_name}
                                </span>
                            ))}
                            {aliases.length > 10 && (
                                <span style={{ fontSize: "0.7rem", color: "#64748b" }}>
                                    +{aliases.length - 10} mais...
                                </span>
                            )}
                        </div>
                    )}
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                    {isMergeMode && !isPrimaryMerge ? (
                        <button
                            onClick={onMerge}
                            style={{
                                background: "rgba(245, 158, 11, 0.2)",
                                border: "none",
                                borderRadius: "8px",
                                width: "36px",
                                height: "36px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: "#f59e0b",
                            }}
                            title="Mesclar com este produto"
                        >
                            <Merge size={16} />
                        </button>
                    ) : (
                        <>
                            <button
                                onClick={onStartMerge}
                                style={{
                                    background: "rgba(245, 158, 11, 0.1)",
                                    border: "none",
                                    borderRadius: "8px",
                                    width: "36px",
                                    height: "36px",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    color: "#f59e0b",
                                }}
                                title="Iniciar merge"
                            >
                                <Merge size={16} />
                            </button>
                            <button
                                onClick={onEdit}
                                style={{
                                    background: "rgba(59, 130, 246, 0.1)",
                                    border: "none",
                                    borderRadius: "8px",
                                    width: "36px",
                                    height: "36px",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    color: "var(--primary)",
                                }}
                                title="Editar"
                            >
                                <Edit3 size={16} />
                            </button>
                            <button
                                onClick={onDelete}
                                style={{
                                    background: "rgba(239, 68, 68, 0.1)",
                                    border: "none",
                                    borderRadius: "8px",
                                    width: "36px",
                                    height: "36px",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    color: "#ef4444",
                                }}
                                title="Excluir"
                            >
                                <Trash2 size={16} />
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
