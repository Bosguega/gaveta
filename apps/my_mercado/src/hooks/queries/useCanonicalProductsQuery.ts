import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useErrorHandler } from "../useErrorHandler";
import {
    getCanonicalProducts,
    getCanonicalProduct,
    createCanonicalProduct,
    updateCanonicalProduct,
    deleteCanonicalProduct,
    mergeCanonicalProducts,
    associateItemToCanonicalProduct,
    associateDictionaryToCanonicalProduct,
} from "../../services";
import type { CanonicalProduct } from "../../types/domain";

// Query keys para cache
export const canonicalProductKeys = {
    all: ["canonical-products"] as const,
    lists: () => [...canonicalProductKeys.all, "list"] as const,
    list: () => [...canonicalProductKeys.lists()] as const,
    details: () => [...canonicalProductKeys.all, "detail"] as const,
    detail: (id: string) => [...canonicalProductKeys.details(), id] as const,
};

// Hook para buscar todos os produtos canônicos
export function useCanonicalProductsQuery() {
    return useQuery({
        queryKey: canonicalProductKeys.list(),
        queryFn: getCanonicalProducts,
        staleTime: 5 * 60 * 1000, // 5 minutos
    });
}

// Hook para buscar um produto canônico específico
export function useCanonicalProductQuery(id: string) {
    return useQuery({
        queryKey: canonicalProductKeys.detail(id),
        queryFn: () => getCanonicalProduct(id),
        enabled: !!id,
        staleTime: 5 * 60 * 1000,
    });
}

// Hook para criar produto canônico
export function useCreateCanonicalProduct() {
    const queryClient = useQueryClient();
    const { handleError } = useErrorHandler({ context: "useCreateCanonicalProduct" });

    return useMutation({
        mutationFn: (product: Pick<CanonicalProduct, "slug" | "name" | "category" | "brand">) =>
            createCanonicalProduct(product),
        onSuccess: (newProduct) => {
            // Atualizar cache
            queryClient.setQueryData(canonicalProductKeys.list(), (old: CanonicalProduct[] | undefined) => {
                if (!old) return [newProduct];
                return [...old, newProduct].sort((a, b) => a.name.localeCompare(b.name));
            });
            // Toast movido para o caller (componente ou hook de ações)
        },
        onError: (err) => {
            handleError(err, { messageKey: "PRODUCT_CREATE_FAILED" });
        },
    });
}

// Hook para atualizar produto canônico
export function useUpdateCanonicalProduct() {
    const queryClient = useQueryClient();
    const { handleError } = useErrorHandler({ context: "useUpdateCanonicalProduct" });

    return useMutation({
        mutationFn: ({ id, updates }: { id: string; updates: Partial<Pick<CanonicalProduct, "name" | "category" | "brand">> }) =>
            updateCanonicalProduct(id, updates),
        onSuccess: (_, { id, updates }) => {
            // Atualizar cache
            queryClient.setQueryData(canonicalProductKeys.list(), (old: CanonicalProduct[] | undefined) => {
                if (!old) return old;
                return old.map((product) =>
                    product.id === id ? { ...product, ...updates } : product
                );
            });

            queryClient.setQueryData(canonicalProductKeys.detail(id), (old: CanonicalProduct | undefined) => {
                if (!old) return old;
                return { ...old, ...updates };
            });
            // Toast movido para o caller (componente ou hook de ações)
        },
        onError: (err) => {
            handleError(err, { messageKey: "PRODUCT_UPDATE_FAILED" });
        },
    });
}

// Hook para deletar produto canônico
export function useDeleteCanonicalProduct() {
    const queryClient = useQueryClient();
    const { handleError } = useErrorHandler({ context: "useDeleteCanonicalProduct" });

    return useMutation({
        mutationFn: (id: string) => deleteCanonicalProduct(id),
        onSuccess: (_, deletedId) => {
            // Remover do cache
            queryClient.setQueryData(canonicalProductKeys.list(), (old: CanonicalProduct[] | undefined) => {
                if (!old) return old;
                return old.filter((product) => product.id !== deletedId);
            });

            queryClient.removeQueries({ queryKey: canonicalProductKeys.detail(deletedId) });
            // Toast movido para o caller (componente ou hook de ações)
        },
        onError: (err) => {
            handleError(err, { messageKey: "PRODUCT_DELETE_FAILED" });
        },
    });
}

// Hook para merge de produtos canônicos
export function useMergeCanonicalProducts() {
    const queryClient = useQueryClient();
    const { handleError } = useErrorHandler({ context: "useMergeCanonicalProducts" });

    return useMutation({
        mutationFn: ({ primaryId, secondaryId }: { primaryId: string; secondaryId: string }) =>
            mergeCanonicalProducts(primaryId, secondaryId),
        onSuccess: (_, { secondaryId }) => {
            // Remover secundário do cache
            queryClient.setQueryData(canonicalProductKeys.list(), (old: CanonicalProduct[] | undefined) => {
                if (!old) return old;
                return old.filter((product) => product.id !== secondaryId);
            });

            queryClient.removeQueries({ queryKey: canonicalProductKeys.detail(secondaryId) });

            // Invalidar queries de items e dicionário para atualizar associações
            queryClient.invalidateQueries({ queryKey: ["receipts"] });
            queryClient.invalidateQueries({ queryKey: ["dictionary"] });
            // Toast movido para o caller (componente ou hook de ações)
        },
        onError: (err) => {
            handleError(err, { messageKey: "PRODUCT_MERGE_FAILED" });
        },
    });
}

// Hook para associar item a produto canônico
export function useAssociateItemToCanonicalProduct() {
    const queryClient = useQueryClient();
    const { handleError } = useErrorHandler({ context: "useAssociateItemToCanonicalProduct" });

    return useMutation({
        mutationFn: ({ itemId, canonicalProductId }: { itemId: string; canonicalProductId: string | null }) =>
            associateItemToCanonicalProduct(itemId, canonicalProductId),
        onSuccess: () => {
            // Invalidar queries de receipts para atualizar dados
            queryClient.invalidateQueries({ queryKey: ["receipts"] });
            // Toast movido para o caller (componente ou hook de ações)
        },
        onError: (err) => {
            handleError(err, { messageKey: "PRODUCT_UPDATE_FAILED" });
        },
    });
}

// Hook para associar dicionário a produto canônico
export function useAssociateDictionaryToCanonicalProduct() {
    const queryClient = useQueryClient();
    const { handleError } = useErrorHandler({ context: "useAssociateDictionaryToCanonicalProduct" });

    return useMutation({
        mutationFn: ({ key, canonicalProductId }: { key: string; canonicalProductId: string | null }) =>
            associateDictionaryToCanonicalProduct(key, canonicalProductId),
        onSuccess: () => {
            // Invalidar queries de dicionário
            queryClient.invalidateQueries({ queryKey: ["dictionary"] });
            // Toast movido para o caller (componente ou hook de ações)
        },
        onError: (err) => {
            handleError(err, { messageKey: "PRODUCT_UPDATE_FAILED" });
        },
    });
}
