import { useState } from "react";
import { notify } from "../../utils/notifications";
import {
    useCreateCanonicalProduct,
    useUpdateCanonicalProduct,
    useDeleteCanonicalProduct,
    useMergeCanonicalProducts,
} from "../queries/useCanonicalProductsQuery";
import {
    parseCreateCanonicalProductInput,
    parseUpdateCanonicalProductInput,
} from "../../utils/validation/canonicalProduct";
import type { ConfirmDialogConfig } from "../../types/ui";

interface CreateFormData {
    slug: string;
    name: string;
    category: string;
    brand: string;
}

interface EditFormData {
    name: string;
    category: string;
    brand: string;
}

/**
 * Hook para ações de produtos canônicos
 * Gerencia CRUD e merge de produtos
 */
export function useCanonicalProductActions() {
    const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogConfig | null>(null);
    const [confirmBusy, setConfirmBusy] = useState(false);

    const createProduct = useCreateCanonicalProduct();
    const updateProduct = useUpdateCanonicalProduct();
    const deleteProduct = useDeleteCanonicalProduct();
    const mergeProducts = useMergeCanonicalProducts();

    const closeConfirm = () => {
        confirmDialog?.onCancel?.();
        setConfirmDialog(null);
        setConfirmBusy(false);
    };

    const runConfirm = async () => {
        if (!confirmDialog) return;
        setConfirmBusy(true);
        try {
            await confirmDialog.onConfirm();
            setConfirmDialog(null);
        } finally {
            setConfirmBusy(false);
        }
    };

    const handleCreate = async (formData: CreateFormData) => {
        try {
            const parsed = parseCreateCanonicalProductInput(formData);
            await createProduct.mutateAsync(parsed);
            notify.success("Produto criado com sucesso!");
            return { success: true };
        } catch (err) {
            notify.error(err instanceof Error ? err.message : "Erro ao criar produto.");
            return { success: false, error: err };
        }
    };

    const handleUpdate = async (id: string, formData: EditFormData) => {
        try {
            const parsed = parseUpdateCanonicalProductInput(formData);
            await updateProduct.mutateAsync({ id, updates: parsed });
            notify.updated();
            return { success: true };
        } catch (err) {
            notify.error(err instanceof Error ? err.message : "Erro ao atualizar produto.");
            return { success: false, error: err };
        }
    };

    const handleDelete = (id: string, name: string) => {
        setConfirmDialog({
            title: "Remover produto canônico?",
            message: `Tem certeza que deseja remover "${name}"? Esta ação não pode ser desfeita.`,
            confirmText: "Remover",
            danger: true,
            onConfirm: async () => {
                await deleteProduct.mutateAsync(id);
                notify.deleted();
            },
        });
    };

    const handleMerge = (primaryId: string, primaryName: string, secondaryId: string, secondaryName: string) => {
        setConfirmDialog({
            title: "Mesclar produtos?",
            message: `Mover todas as associações de "${secondaryName}" para "${primaryName}"? O produto secundário será removido.`,
            confirmText: "Mesclar",
            danger: true,
            onConfirm: async () => {
                await mergeProducts.mutateAsync({ primaryId, secondaryId });
                notify.success("Produtos mesclados!");
            },
        });
    };

    return {
        confirmDialog,
        confirmBusy,
        handleCreate,
        handleUpdate,
        handleDelete,
        handleMerge,
        closeConfirm,
        runConfirm,
    };
}
