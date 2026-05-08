import { useState } from "react";
import { Save, X } from "lucide-react";
import { toCanonicalSlug } from "../../utils/validation/canonicalProduct";

interface CreateFormData {
    slug: string;
    name: string;
    category: string;
    brand: string;
}

interface CanonicalProductFormProps {
    onCreate: (data: CreateFormData) => Promise<{ success: boolean }>;
    onCancel: () => void;
}

/**
 * Formulário para criação de produto canônico
 */
export function CanonicalProductForm({ onCreate, onCancel }: CanonicalProductFormProps) {
    const [formData, setFormData] = useState<CreateFormData>({
        slug: "",
        name: "",
        category: "",
        brand: "",
    });
    const [busy, setBusy] = useState(false);

    const handleSubmit = async () => {
        setBusy(true);
        try {
            const result = await onCreate(formData);
            if (result.success) {
                setFormData({ slug: "", name: "", category: "", brand: "" });
                onCancel();
            }
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="glass-card" style={{ padding: "1.25rem", marginBottom: "1rem" }}>
            <h3 style={{ color: "#fff", marginBottom: "1rem", fontSize: "1rem" }}>
                Criar Produto Canônico
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <input
                    type="text"
                    className="search-input"
                    placeholder="Slug (ex: coca_cola_2l)"
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: toCanonicalSlug(e.target.value) })}
                />
                <input
                    type="text"
                    className="search-input"
                    placeholder="Nome amigável (ex: Coca-Cola 2L)"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
                <input
                    type="text"
                    className="search-input"
                    placeholder="Categoria (opcional)"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                />
                <input
                    type="text"
                    className="search-input"
                    placeholder="Marca (opcional)"
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                />
                <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button
                        className="btn btn-success"
                        style={{ flex: 1 }}
                        onClick={handleSubmit}
                        disabled={busy}
                    >
                        <Save size={18} /> {busy ? "Criando..." : "Criar"}
                    </button>
                    <button
                        className="btn"
                        style={{ flex: 1 }}
                        onClick={onCancel}
                        disabled={busy}
                    >
                        <X size={18} /> Cancelar
                    </button>
                </div>
            </div>
        </div>
    );
}
