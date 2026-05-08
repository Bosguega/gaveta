import { X } from "lucide-react";

interface MergeModeBannerProps {
    primaryName: string;
    onCancel: () => void;
}

/**
 * Banner exibido quando o modo merge está ativo
 */
export function MergeModeBanner({ primaryName, onCancel }: MergeModeBannerProps) {
    return (
        <div
            className="glass-card"
            style={{
                padding: "1.25rem",
                marginBottom: "1rem",
                background: "rgba(245, 158, 11, 0.1)",
                border: "1px solid rgba(245, 158, 11, 0.2)"
            }}
        >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                    <h3 style={{ color: "#fbbf24", marginBottom: "0.25rem", fontSize: "1rem" }}>
                        Modo Merge Ativo
                    </h3>
                    <p style={{ color: "#94a3b8", fontSize: "0.85rem" }}>
                        Selecione um produto para mesclar com &quot;{primaryName}&quot;
                    </p>
                </div>
                <button
                    className="btn"
                    onClick={onCancel}
                    style={{ padding: "0.5rem" }}
                >
                    <X size={18} />
                </button>
            </div>
        </div>
    );
}
