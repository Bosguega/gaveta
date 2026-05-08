import { useState } from "react";
import { Save, X } from "lucide-react";
import { parseUpdateCanonicalProductInput } from "../../utils/validation/canonicalProduct";
import { useUpdateCanonicalProduct } from "../../hooks/queries/useCanonicalProductsQuery";
import type { CanonicalProduct } from "../../types/domain";

interface EditFormData {
    name: string;
    category: string;
    brand: string;
}

interface CanonicalProductEditFormProps {
    product: CanonicalProduct;
    onSave: () => void;
    onCancel: () => void;
}

/**
 * Formulário para edição de produto canônico
 */
export function CanonicalProductEditForm({ product, onSave, onCancel }: CanonicalProductEditFormProps) {
    const [formData, setFormData] = useState<EditFormData>({
        name: product.name,
        category: product.category || "",
        brand: product.brand || "",
    });
    const [busy, setBusy] = useState(false);

    const updateProduct = useUpdateCanonicalProduct();

    const handleSubmit = async () => {
        setBusy(true);
        try {
            const parsed = parseUpdateCanonicalProductInput(formData);
            await updateProduct.mutateAsync({ id: product.id, updates: parsed });
            onSave();
        } catch (_err) {
            // Erro já é tratado pelo hook
        } finally {
            setBusy(false);
        }
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <div style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: "bold" }}>
                SLUG: {product.slug}
            </div>
            <input
                type="text"
                className="search-input"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Nome"
            />
            <input
                type="text"
                className="search-input"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                placeholder="Categoria"
            />
            <input
                type="text"
                className="search-input"
                value={formData.brand}
                onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                placeholder="Marca"
            />
            <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                    className="btn btn-success"
                    style={{ flex: 1 }}
                    onClick={handleSubmit}
                    disabled={busy}
                >
                    <Save size={18} /> {busy ? "Salvando..." : "Salvar"}
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
    );
}
