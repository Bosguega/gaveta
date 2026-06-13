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
            establishment,
            nomeFantasia,
        }: {
            establishment: string;
            nomeFantasia: string;
        }) => {
            await upsertEstablishmentDictionaryEntryInDB(establishment, nomeFantasia);
            return { establishment, nomeFantasia };
        },
        onSuccess: ({ establishment, nomeFantasia }) => {
            queryClient.setQueryData(
                establishmentDictionaryKeys.list(),
                (old: EstablishmentDictionaryEntry[] | undefined) => {
                    if (!old) return old;
                    const exists = old.find((entry) => entry.establishment === establishment);
                    if (exists) {
                        return old.map((entry) =>
                            entry.establishment === establishment
                                ? { ...entry, nome_fantasia: nomeFantasia }
                                : entry,
                        );
                    }
                    return [
                        ...old,
                        {
                            establishment: establishment,
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
        mutationFn: async (establishment: string) => {
            await deleteEstablishmentDictionaryEntryFromDB(establishment);
            return establishment;
        },
        onSuccess: (deletedEstablishment) => {
            queryClient.setQueryData(
                establishmentDictionaryKeys.list(),
                (old: EstablishmentDictionaryEntry[] | undefined) => {
                    if (!old) return old;
                    return old.filter((entry) => entry.establishment !== deletedEstablishment);
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