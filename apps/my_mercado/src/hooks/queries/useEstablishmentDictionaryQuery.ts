import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    applyEstablishmentEntryToSavedReceipts,
    clearEstablishmentDictionaryInDB,
    deleteEstablishmentDictionaryEntryFromDB,
    getFullEstablishmentDictionaryFromDB,
    upsertEstablishmentDictionaryEntryInDB,
} from "../../services";
import type { EstablishmentDictionaryEntry } from "../../types/domain";

export const establishmentDictionaryKeys = {
    all: ["establishment-dictionary"] as const,
    lists: () => [...establishmentDictionaryKeys.all, "list"] as const,
    list: () => [...establishmentDictionaryKeys.lists()] as const,
};

export function useEstablishmentDictionaryQuery() {
    return useQuery({
        queryKey: establishmentDictionaryKeys.list(),
        queryFn: getFullEstablishmentDictionaryFromDB,
        staleTime: 5 * 60 * 1000,
    });
}

export function useUpsertEstablishmentDictionaryEntry() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            nomeNota,
            nomeFantasia,
        }: {
            nomeNota: string;
            nomeFantasia: string;
        }) => {
            await upsertEstablishmentDictionaryEntryInDB(nomeNota, nomeFantasia);
            return { nomeNota, nomeFantasia };
        },
        onSuccess: ({ nomeNota, nomeFantasia }) => {
            queryClient.setQueryData(
                establishmentDictionaryKeys.list(),
                (old: EstablishmentDictionaryEntry[] | undefined) => {
                    if (!old) return old;
                    const exists = old.find((entry) => entry.nome_nota === nomeNota);
                    if (exists) {
                        return old.map((entry) =>
                            entry.nome_nota === nomeNota
                                ? { ...entry, nome_fantasia: nomeFantasia }
                                : entry,
                        );
                    }
                    return [
                        ...old,
                        {
                            nome_nota: nomeNota,
                            nome_fantasia: nomeFantasia,
                            created_at: new Date().toISOString(),
                        },
                    ];
                },
            );
        },
    });
}

export function useDeleteEstablishmentDictionaryEntry() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (nomeNota: string) => {
            await deleteEstablishmentDictionaryEntryFromDB(nomeNota);
            return nomeNota;
        },
        onSuccess: (deletedNomeNota) => {
            queryClient.setQueryData(
                establishmentDictionaryKeys.list(),
                (old: EstablishmentDictionaryEntry[] | undefined) => {
                    if (!old) return old;
                    return old.filter((entry) => entry.nome_nota !== deletedNomeNota);
                },
            );
        },
    });
}

export function useClearEstablishmentDictionary() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: clearEstablishmentDictionaryInDB,
        onSuccess: () => {
            queryClient.setQueryData(
                establishmentDictionaryKeys.list(),
                [] as EstablishmentDictionaryEntry[],
            );
        },
    });
}

export function useApplyEstablishmentEntryToSavedReceipts() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({
            oldName,
            newName,
        }: {
            oldName: string;
            newName: string;
        }) => applyEstablishmentEntryToSavedReceipts(oldName, newName),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["receipts"] });
        },
    });
}