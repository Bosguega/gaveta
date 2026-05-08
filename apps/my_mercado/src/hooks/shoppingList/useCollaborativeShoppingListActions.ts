import { useState } from "react";
import { notify } from "../../utils/notifications";
import { errorMessages } from "../../utils/errorMessages";
import {
  useCreateCollaborativeList,
  useJoinCollaborativeListByCode,
  useRenameCollaborativeList,
  useDeleteCollaborativeList,
  useRegenerateCollaborativeListCode,
  useAddCollaborativeListItem,
  useRemoveCollaborativeListItem,
  useToggleCollaborativeListItem,
  useClearCollaborativeListItems,
  useUpdateCollaborativeListMemberRole,
  useRemoveCollaborativeListMember,
  useTransferCollaborativeListOwnership,
} from "../queries/useCollaborativeShoppingListsQuery";
import { isDuplicatePendingItemError } from "../../services/collaborativeShoppingListService";
import type { ConfirmDialogConfig } from "../../types/ui";

/**
 * Hook para ações de lista de compras colaborativa
 * Gerencia operações CRUD e membros em listas colaborativas
 */
export function useCollaborativeShoppingListActions(_sessionUserId: string | null | undefined) {
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogConfig | null>(null);

  const createCollaborativeList = useCreateCollaborativeList();
  const joinCollaborativeList = useJoinCollaborativeListByCode();
  const renameCollaborativeList = useRenameCollaborativeList();
  const deleteCollaborativeList = useDeleteCollaborativeList();
  const regenerateCollaborativeCode = useRegenerateCollaborativeListCode();
  const addCollaborativeItem = useAddCollaborativeListItem();
  const removeCollaborativeItem = useRemoveCollaborativeListItem();
  const toggleCollaborativeItem = useToggleCollaborativeListItem();
  const clearCollaborativeItems = useClearCollaborativeListItems();
  const updateCollaborativeMemberRole = useUpdateCollaborativeListMemberRole();
  const removeCollaborativeMember = useRemoveCollaborativeListMember();
  const transferCollaborativeOwnership = useTransferCollaborativeListOwnership();

  const handleCreateList = async (name: string) => {
    try {
      const created = await createCollaborativeList.mutateAsync(name);
      notify.collabListCreated();
      return created;
    } catch {
      notify.error(errorMessages.COLLAB_CREATE_FAILED);
      return null;
    }
  };

  const handleJoinByCode = async (code: string) => {
    try {
      const joined = await joinCollaborativeList.mutateAsync(code);
      notify.collabListJoined();
      return joined;
    } catch {
      notify.error(errorMessages.COLLAB_JOIN_FAILED);
      return null;
    }
  };

  const handleRenameList = async (listId: string, nextName: string) => {
    try {
      await renameCollaborativeList.mutateAsync({ listId, name: nextName });
      notify.listRenamed();
      return true;
    } catch {
      notify.error(errorMessages.COLLAB_RENAME_FAILED);
      return false;
    }
  };

  const handleDeleteList = async (listId: string) => {
    try {
      await deleteCollaborativeList.mutateAsync(listId);
      notify.deleted();
      return true;
    } catch {
      notify.error(errorMessages.COLLAB_DELETE_FAILED);
      return false;
    }
  };

  const handleAddItem = async (listId: string, name: string, quantity?: string) => {
    try {
      await addCollaborativeItem.mutateAsync({ listId, name, quantity });
      notify.itemAdded();
      return true;
    } catch (error) {
      if (isDuplicatePendingItemError(error)) {
        notify.alreadyExists();
      } else {
        notify.error(errorMessages.COLLAB_ADD_ITEM_FAILED);
      }
      return false;
    }
  };

  const handleToggleItem = async (listId: string, itemId: string, nextChecked: boolean) => {
    try {
      await toggleCollaborativeItem.mutateAsync({ listId, itemId, nextChecked });
      return true;
    } catch {
      notify.error(errorMessages.UPDATE_FAILED);
      return false;
    }
  };

  const handleRemoveItem = async (listId: string, itemId: string) => {
    try {
      await removeCollaborativeItem.mutateAsync({ listId, itemId });
      notify.itemRemoved();
      return true;
    } catch {
      notify.error(errorMessages.ITEM_REMOVE_FAILED);
      return false;
    }
  };

  const handleClearChecked = async (listId: string) => {
    try {
      await clearCollaborativeItems.mutateAsync({ listId, onlyChecked: true });
      notify.listClearChecked();
      return true;
    } catch {
      notify.error(errorMessages.OPERATION_FAILED);
      return false;
    }
  };

  const handleClearAll = async (listId: string) => {
    try {
      await clearCollaborativeItems.mutateAsync({ listId, onlyChecked: false });
      notify.listClearAll();
      return true;
    } catch {
      notify.error(errorMessages.OPERATION_FAILED);
      return false;
    }
  };

  const handleCopyShareCode = async (shareCode: string) => {
    try {
      await navigator.clipboard.writeText(shareCode);
      notify.collabCodeCopied();
      return true;
    } catch {
      notify.error(errorMessages.COLLAB_COPY_CODE_FAILED);
      return false;
    }
  };

  const handleRegenerateCode = async (listId: string) => {
    try {
      const newCode = await regenerateCollaborativeCode.mutateAsync(listId);
      await navigator.clipboard.writeText(newCode);
      notify.collabCodeRegenerated();
      return newCode;
    } catch {
      notify.error(errorMessages.COLLAB_REGENERATE_CODE_FAILED);
      return null;
    }
  };

  const handleChangeMemberRole = async (listId: string, userId: string, nextRole: "editor" | "viewer") => {
    try {
      await updateCollaborativeMemberRole.mutateAsync({ listId, userId, role: nextRole });
      notify.collabMemberRoleUpdated();
      return true;
    } catch {
      notify.error(errorMessages.COLLAB_MEMBER_ROLE_FAILED);
      return false;
    }
  };

  const handleRemoveMember = async (listId: string, userId: string) => {
    try {
      await removeCollaborativeMember.mutateAsync({ listId, userId });
      notify.collabMemberRemoved();
      return true;
    } catch {
      notify.error(errorMessages.COLLAB_MEMBER_REMOVE_FAILED);
      return false;
    }
  };

  const handleLeaveList = async (listId: string, userId: string) => {
    try {
      await removeCollaborativeMember.mutateAsync({ listId, userId });
      notify.collabLeft();
      return true;
    } catch {
      notify.error(errorMessages.COLLAB_LEAVE_FAILED);
      return false;
    }
  };

  const handleTransferOwnership = async (listId: string, newOwnerUserId: string) => {
    try {
      await transferCollaborativeOwnership.mutateAsync({ listId, newOwnerUserId });
      notify.collabOwnershipTransferred();
      return true;
    } catch {
      notify.error(errorMessages.COLLAB_OWNERSHIP_TRANSFER_FAILED);
      return false;
    }
  };

  const confirmDeleteList = (listId: string, listName: string) => {
    setConfirmDialog({
      title: "Excluir lista colaborativa?",
      message: `A lista "${listName}" e seus itens serao removidos.`,
      confirmText: "Excluir lista",
      danger: true,
      onConfirm: async () => {
        await handleDeleteList(listId);
      },
    });
  };

  const confirmClearChecked = (listId: string) => {
    setConfirmDialog({
      title: "Limpar itens marcados?",
      message: "Todos os itens ja marcados como comprados serao removidos da lista.",
      confirmText: "Limpar marcados",
      danger: true,
      onConfirm: async () => {
        await handleClearChecked(listId);
      },
    });
  };

  const confirmClearAll = (listId: string) => {
    setConfirmDialog({
      title: "Limpar lista completa?",
      message: "Essa acao remove todos os itens da lista atual e nao pode ser desfeita.",
      confirmText: "Limpar lista",
      danger: true,
      onConfirm: async () => {
        await handleClearAll(listId);
      },
    });
  };

  const confirmTransferOwnership = (listId: string, targetUserId: string) => {
    setConfirmDialog({
      title: "Transferir ownership?",
      message: "Voce deixara de ser owner e passara a ser editor nesta lista.",
      confirmText: "Transferir",
      danger: false,
      onConfirm: async () => {
        await handleTransferOwnership(listId, targetUserId);
      },
    });
  };

  const closeConfirm = () => {
    confirmDialog?.onCancel?.();
    setConfirmDialog(null);
  };

  return {
    confirmDialog,
    handleCreateList,
    handleJoinByCode,
    handleRenameList,
    handleDeleteList,
    handleAddItem,
    handleToggleItem,
    handleRemoveItem,
    handleClearChecked,
    handleClearAll,
    handleCopyShareCode,
    handleRegenerateCode,
    handleChangeMemberRole,
    handleRemoveMember,
    handleLeaveList,
    handleTransferOwnership,
    confirmDeleteList,
    confirmClearChecked,
    confirmClearAll,
    confirmTransferOwnership,
    closeConfirm,
  };
}
