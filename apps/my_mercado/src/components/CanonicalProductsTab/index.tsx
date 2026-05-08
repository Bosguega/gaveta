import { useState, useMemo, useEffect } from "react";
import { Package, Plus } from "lucide-react";
import { logger } from "../../utils/logger";
import { getFullDictionaryFromDB } from "../../services";
import { useCanonicalProductsQuery } from "../../hooks/queries/useCanonicalProductsQuery";
import { useCanonicalProductActions } from "../../hooks/canonicalProduct/useCanonicalProductActions";
import { filterBySearch, SEARCH_CONFIG } from "../../utils/filters";
import UniversalSearchBar from "../UniversalSearchBar";
import ConfirmDialog from "../ConfirmDialog";
import { ProductSkeleton } from "../Skeleton";
import { CanonicalProductForm } from "./CanonicalProductForm";
import { CanonicalProductEditForm } from "./CanonicalProductEditForm";
import { CanonicalProductItem } from "./CanonicalProductItem";
import { MergeModeBanner } from "./MergeModeBanner";
import type { CanonicalProduct, DictionaryEntry } from "../../types/domain";

/**
 * Componente principal de Produtos Canônicos
 *
 * Gerencia CRUD e merge de produtos canônicos
 */
export function CanonicalProductsTab() {
    const { data: products = [], isLoading: loading } = useCanonicalProductsQuery();
    const actions = useCanonicalProductActions();

    const [searchQuery, setSearchQuery] = useState("");
    const [editingId, setEditingId] = useState<string | null>(null);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [mergeMode, setMergeMode] = useState<{ primaryId: string; primaryName: string } | null>(null);
    const [dictionary, setDictionary] = useState<DictionaryEntry[]>([]);

    useEffect(() => {
        getFullDictionaryFromDB()
            .then(setDictionary)
            .catch(err => {
                logger.error("CanonicalProducts", "Erro ao carregar dicionário", err);
            });
    }, [products]);

    // Filtrar produtos
    const filteredProducts = useMemo(() => {
        return filterBySearch(products, searchQuery, SEARCH_CONFIG.canonicalProduct);
    }, [products, searchQuery]);

    const handleCreate = async (formData: { slug: string; name: string; category: string; brand: string }) => {
        const result = await actions.handleCreate(formData);
        if (result.success) {
            setCreateFormDefaults();
            setShowCreateForm(false);
        }
        return result;
    };

    const setCreateFormDefaults = () => {
        // Form é resetado dentro do componente filho
    };

    const handleStartMerge = (product: CanonicalProduct) => {
        setMergeMode({ primaryId: product.id, primaryName: product.name });
    };

    const handleMerge = (secondaryProduct: CanonicalProduct) => {
        if (!mergeMode) return;
        actions.handleMerge(mergeMode.primaryId, mergeMode.primaryName, secondaryProduct.id, secondaryProduct.name);
        setMergeMode(null);
    };

    const editingProduct = products.find(p => p.id === editingId);

    return (
        <>
            {/* Header */}
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: "1.25rem",
                    gap: "1rem",
                }}
            >
                <div style={{ flex: 1 }}>
                    <h2 className="section-title" style={{ marginBottom: "0.25rem" }}>
                        <Package size={20} color="var(--primary)" />
                        Produtos Canônicos
                    </h2>
                    <div style={{ fontSize: "0.75rem", color: "#64748b", marginLeft: "2rem" }}>
                        {filteredProducts.length} de {products.length} produtos
                    </div>
                </div>
                <button
                    className="btn btn-success"
                    onClick={() => setShowCreateForm(true)}
                    style={{ padding: "0.5rem 1rem" }}
                >
                    <Plus size={18} />
                    Novo
                </button>
            </div>

            {/* Formulário de criação */}
            {showCreateForm && (
                <CanonicalProductForm
                    onCreate={handleCreate}
                    onCancel={() => setShowCreateForm(false)}
                />
            )}

            {/* Modo Merge */}
            {mergeMode && (
                <MergeModeBanner
                    primaryName={mergeMode.primaryName}
                    onCancel={() => setMergeMode(null)}
                />
            )}

            {/* Barra de busca */}
            <UniversalSearchBar
                placeholder="Buscar produtos canônicos..."
                value={searchQuery}
                onChange={setSearchQuery}
            />

            {/* Lista de produtos */}
            <div className="items-list" style={{ gap: "1rem" }}>
                {loading ? (
                    [...Array(3)].map((_, i) => <ProductSkeleton key={i} />)
                ) : filteredProducts.length === 0 ? (
                    <div className="glass-card" style={{ textAlign: "center", padding: "3rem" }}>
                        <Package size={48} color="var(--primary)" style={{ opacity: 0.3, marginBottom: "1rem" }} />
                        <p style={{ color: "#64748b" }}>
                            {searchQuery ? "Nenhum produto encontrado." : "Nenhum produto canônico cadastrado."}
                        </p>
                    </div>
                ) : (
                    filteredProducts.map((product) => {
                        const aliases = dictionary.filter(d => d.canonical_product_id === product.id);
                        const isEditing = editingId === product.id;
                        const isPrimaryMerge = mergeMode?.primaryId === product.id;
                        const isMergeModeActive = mergeMode !== null;

                        if (isEditing && editingProduct) {
                            return (
                                <div key={product.id} className="glass-card animated-item" style={{ padding: "1.25rem" }}>
                                    <CanonicalProductEditForm
                                        product={editingProduct}
                                        onSave={() => setEditingId(null)}
                                        onCancel={() => setEditingId(null)}
                                    />
                                </div>
                            );
                        }

                        return (
                            <CanonicalProductItem
                                key={product.id}
                                product={product}
                                aliases={aliases}
                                isMergeMode={isMergeModeActive}
                                isPrimaryMerge={isPrimaryMerge}
                                onEdit={() => setEditingId(product.id)}
                                onDelete={() => actions.handleDelete(product.id, product.name)}
                                onStartMerge={() => handleStartMerge(product)}
                                onMerge={() => handleMerge(product)}
                            />
                        );
                    })
                )}
            </div>

            {/* Confirm Dialog */}
            <ConfirmDialog
                isOpen={Boolean(actions.confirmDialog)}
                title={actions.confirmDialog?.title || ""}
                message={actions.confirmDialog?.message || ""}
                confirmText={actions.confirmDialog?.confirmText}
                cancelText={actions.confirmDialog?.cancelText}
                danger={actions.confirmDialog?.danger}
                busy={actions.confirmBusy}
                onCancel={actions.closeConfirm}
                onConfirm={actions.runConfirm}
            />
        </>
    );
}
