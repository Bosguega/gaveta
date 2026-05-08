import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { requireSupabase } from "../../services/authService";
import {
  addCollaborativeListItemToDB,
  clearCollaborativeListItemsInDB,
  createCollaborativeListInDB,
  deleteCollaborativeListInDB,
  getCollaborativeListItemsFromDB,
  getCollaborativeListMembersFromDB,
  getCollaborativeListsFromDB,
  joinCollaborativeListByCodeInDB,
  regenerateCollaborativeListCodeInDB,
  removeCollaborativeListMemberFromDB,
  removeCollaborativeListItemFromDB,
  renameCollaborativeListInDB,
  toggleCollaborativeListItemInDB,
  transferCollaborativeListOwnershipInDB,
  updateCollaborativeListMemberRoleInDB,
} from "../../services/collaborativeShoppingListService";

export const collaborativeShoppingKeys = {
  all: ["collaborative-shopping"] as const,
  lists: () => [...collaborativeShoppingKeys.all, "lists"] as const,
  listItems: (listId: string | null) =>
    [...collaborativeShoppingKeys.all, "items", listId || "none"] as const,
  listMembers: (listId: string | null) =>
    [...collaborativeShoppingKeys.all, "members", listId || "none"] as const,
};

export function useCollaborativeListsQuery(enabled: boolean) {
  return useQuery({
    queryKey: collaborativeShoppingKeys.lists(),
    queryFn: getCollaborativeListsFromDB,
    enabled,
    staleTime: 60_000,
  });
}

export function useCollaborativeListItemsQuery(listId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: collaborativeShoppingKeys.listItems(listId),
    queryFn: () => getCollaborativeListItemsFromDB(listId as string),
    enabled: enabled && Boolean(listId),
    staleTime: 15_000,
  });
}

export function useCollaborativeListMembersQuery(listId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: collaborativeShoppingKeys.listMembers(listId),
    queryFn: () => getCollaborativeListMembersFromDB(listId as string),
    enabled: enabled && Boolean(listId),
    staleTime: 15_000,
  });
}

export function useCollaborativeListRealtime(listId: string | null, enabled: boolean) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled || !listId) return;

    let isDisposed = false;
    const client = requireSupabase();
    const channel = client
      .channel(`shopping-list-items:${listId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "shopping_list_items",
          filter: `list_id=eq.${listId}`,
        },
        () => {
          if (isDisposed) return;
          queryClient.invalidateQueries({
            queryKey: collaborativeShoppingKeys.listItems(listId),
          });
          queryClient.invalidateQueries({
            queryKey: collaborativeShoppingKeys.lists(),
          });
          queryClient.invalidateQueries({
            queryKey: collaborativeShoppingKeys.listMembers(listId),
          });
        },
      )
      .subscribe();

    return () => {
      isDisposed = true;
      client.removeChannel(channel);
    };
  }, [enabled, listId, queryClient]);
}

function useInvalidateCollaborativeQueries() {
  const queryClient = useQueryClient();
  return (listId?: string | null) => {
    queryClient.invalidateQueries({
      queryKey: collaborativeShoppingKeys.lists(),
    });
    if (listId) {
      queryClient.invalidateQueries({
        queryKey: collaborativeShoppingKeys.listItems(listId),
      });
      queryClient.invalidateQueries({
        queryKey: collaborativeShoppingKeys.listMembers(listId),
      });
    }
  };
}

export function useCreateCollaborativeList() {
  const invalidate = useInvalidateCollaborativeQueries();
  return useMutation({
    mutationFn: createCollaborativeListInDB,
    onSuccess: () => invalidate(),
  });
}

export function useJoinCollaborativeListByCode() {
  const invalidate = useInvalidateCollaborativeQueries();
  return useMutation({
    mutationFn: joinCollaborativeListByCodeInDB,
    onSuccess: () => invalidate(),
  });
}

export function useRenameCollaborativeList() {
  const invalidate = useInvalidateCollaborativeQueries();
  return useMutation({
    mutationFn: ({ listId, name }: { listId: string; name: string }) =>
      renameCollaborativeListInDB(listId, name),
    onSuccess: (_, vars) => invalidate(vars.listId),
  });
}

export function useDeleteCollaborativeList() {
  const invalidate = useInvalidateCollaborativeQueries();
  return useMutation({
    mutationFn: (listId: string) => deleteCollaborativeListInDB(listId),
    onSuccess: () => invalidate(),
  });
}

export function useRegenerateCollaborativeListCode() {
  const invalidate = useInvalidateCollaborativeQueries();
  return useMutation({
    mutationFn: (listId: string) => regenerateCollaborativeListCodeInDB(listId),
    onSuccess: (_, listId) => invalidate(listId),
  });
}

export function useAddCollaborativeListItem() {
  const invalidate = useInvalidateCollaborativeQueries();
  return useMutation({
    mutationFn: ({
      listId,
      name,
      quantity,
    }: {
      listId: string;
      name: string;
      quantity?: string;
    }) => addCollaborativeListItemToDB(listId, name, quantity),
    onSuccess: (_, vars) => invalidate(vars.listId),
  });
}

export function useToggleCollaborativeListItem() {
  const invalidate = useInvalidateCollaborativeQueries();
  return useMutation({
    mutationFn: ({
      listId,
      itemId,
      nextChecked,
    }: {
      listId: string;
      itemId: string;
      nextChecked: boolean;
    }) => toggleCollaborativeListItemInDB(listId, itemId, nextChecked),
    onSuccess: (_, vars) => invalidate(vars.listId),
  });
}

export function useRemoveCollaborativeListItem() {
  const invalidate = useInvalidateCollaborativeQueries();
  return useMutation({
    mutationFn: ({ listId, itemId }: { listId: string; itemId: string }) =>
      removeCollaborativeListItemFromDB(listId, itemId),
    onSuccess: (_, vars) => invalidate(vars.listId),
  });
}

export function useClearCollaborativeListItems() {
  const invalidate = useInvalidateCollaborativeQueries();
  return useMutation({
    mutationFn: ({
      listId,
      onlyChecked,
    }: {
      listId: string;
      onlyChecked: boolean;
    }) => clearCollaborativeListItemsInDB(listId, onlyChecked),
    onSuccess: (_, vars) => invalidate(vars.listId),
  });
}

export function useUpdateCollaborativeListMemberRole() {
  const invalidate = useInvalidateCollaborativeQueries();
  return useMutation({
    mutationFn: ({
      listId,
      userId,
      role,
    }: {
      listId: string;
      userId: string;
      role: "editor" | "viewer";
    }) => updateCollaborativeListMemberRoleInDB(listId, userId, role),
    onSuccess: (_, vars) => invalidate(vars.listId),
  });
}

export function useRemoveCollaborativeListMember() {
  const invalidate = useInvalidateCollaborativeQueries();
  return useMutation({
    mutationFn: ({ listId, userId }: { listId: string; userId: string }) =>
      removeCollaborativeListMemberFromDB(listId, userId),
    onSuccess: (_, vars) => invalidate(vars.listId),
  });
}

export function useTransferCollaborativeListOwnership() {
  const invalidate = useInvalidateCollaborativeQueries();
  return useMutation({
    mutationFn: ({ listId, newOwnerUserId }: { listId: string; newOwnerUserId: string }) =>
      transferCollaborativeListOwnershipInDB(listId, newOwnerUserId),
    onSuccess: (_, vars) => invalidate(vars.listId),
  });
}
