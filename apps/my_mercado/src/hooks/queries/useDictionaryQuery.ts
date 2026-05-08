import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  applyDictionaryEntryToSavedItems,
  clearDictionaryInDB,
  deleteDictionaryEntryFromDB,
  getFullDictionaryFromDB,
  updateDictionaryEntryInDB,
} from "../../services";
import type { DictionaryEntry } from "../../types/domain";

export const dictionaryKeys = {
  all: ["dictionary"] as const,
  lists: () => [...dictionaryKeys.all, "list"] as const,
  list: () => [...dictionaryKeys.lists()] as const,
};

export function useDictionaryQuery() {
  return useQuery({
    queryKey: dictionaryKeys.list(),
    queryFn: getFullDictionaryFromDB,
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateDictionaryEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      key,
      normalizedName,
      category,
      canonicalProductId,
    }: {
      key: string;
      normalizedName: string;
      category: string;
      canonicalProductId?: string | null;
    }) => {
      await updateDictionaryEntryInDB(
        key,
        normalizedName,
        category,
        canonicalProductId,
      );

      return { key, normalizedName, category, canonicalProductId };
    },
    onSuccess: ({ key, normalizedName, category, canonicalProductId }) => {
      queryClient.setQueryData(
        dictionaryKeys.list(),
        (old: DictionaryEntry[] | undefined) => {
          if (!old) return old;
          return old.map((entry) =>
            entry.key === key
              ? {
                  ...entry,
                  normalized_name: normalizedName,
                  category,
                  canonical_product_id: canonicalProductId ?? undefined,
                }
              : entry,
          );
        },
      );
    },
  });
}

export function useDeleteDictionaryEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (key: string) => {
      await deleteDictionaryEntryFromDB(key);
      return key;
    },
    onSuccess: (deletedKey) => {
      queryClient.setQueryData(
        dictionaryKeys.list(),
        (old: DictionaryEntry[] | undefined) => {
          if (!old) return old;
          return old.filter((entry) => entry.key !== deletedKey);
        },
      );
    },
  });
}

export function useClearDictionary() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: clearDictionaryInDB,
    onSuccess: () => {
      queryClient.setQueryData(dictionaryKeys.list(), [] as DictionaryEntry[]);
    },
  });
}

export function useApplyDictionaryEntryToSavedItems() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      key,
      normalizedName,
      category,
    }: {
      key: string;
      normalizedName?: string;
      category?: string;
    }) => applyDictionaryEntryToSavedItems(key, normalizedName, category),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["receipts"] });
    },
  });
}
