import { useState } from "react";
import { notify } from "../../utils/notifications";
import { errorMessages } from "../../utils/errorMessages";
import { useShoppingListStore } from "../../stores/useShoppingListStore";
import type { ConfirmDialogConfig } from "../../types/ui";

/**
 * Hook para ações de lista de compras local
 * Gerencia operações CRUD em listas locais
 */
export function useLocalShoppingListActions(sessionUserId: string | null | undefined) {
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogConfig | null>(null);

  const createList = useShoppingListStore((state) => state.createList);
  const renameList = useShoppingListStore((state) => state.renameList);
  const deleteList = useShoppingListStore((state) => state.deleteList);
  const addItem = useShoppingListStore((state) => state.addItem);
  const toggleChecked = useShoppingListStore((state) => state.toggleChecked);
  const removeItem = useShoppingListStore((state) => state.removeItem);
  const clearChecked = useShoppingListStore((state) => state.clearChecked);
  const clearAll = useShoppingListStore((state) => state.clearAll);
  const moveItemToList = useShoppingListStore((state) => state.moveItemToList);
  const copyItemToList = useShoppingListStore((state) => state.copyItemToList);

  const handleCreateList = (name: string) => {
    const result = createList(sessionUserId, name);
    if (!result.ok) {
      if (result.reason === "duplicate") {
        notify.alreadyExists();
      } else {
        notify.error(errorMessages.LIST_EMPTY_NAME);
      }
      return false;
    }
    notify.listCreated();
    return true;
  };

  const handleRenameList = (listId: string, nextName: string) => {
    const result = renameList(sessionUserId, listId, nextName);
    if (!result.ok) {
      if (result.reason === "duplicate") {
        notify.alreadyExists();
      } else {
        notify.error(errorMessages.LIST_RENAME_FAILED);
      }
      return false;
    }
    notify.listRenamed();
    return true;
  };

  const handleDeleteList = (listId: string, listName: string, listsCount: number) => {
    if (listsCount <= 1) {
      notify.error(errorMessages.LIST_DELETE_LAST);
      return false;
    }

    const result = deleteList(sessionUserId, listId);
    if (!result.ok) {
      notify.error(errorMessages.LIST_DELETE_FAILED);
      return false;
    }
    notify.deleted();
    return true;
  };

  const handleAddItem = (name: string, quantity?: string) => {
    const result = addItem(sessionUserId, name, quantity);
    if (!result.ok) {
      if (result.reason === "duplicate") {
        notify.alreadyExists();
      } else {
        notify.error(errorMessages.ITEM_EMPTY_NAME);
      }
      return false;
    }
    notify.itemAdded();
    return true;
  };

  const handleToggleItem = (itemId: string) => {
    toggleChecked(sessionUserId, itemId);
  };

  const handleRemoveItem = (itemId: string) => {
    removeItem(sessionUserId, itemId);
    notify.itemRemoved();
  };

  const handleClearChecked = () => {
    clearChecked(sessionUserId);
    notify.listClearChecked();
  };

  const handleClearAll = () => {
    clearAll(sessionUserId);
    notify.listClearAll();
  };

  const handleMoveItem = (itemId: string, targetListId: string, sourceListId: string) => {
    const result = moveItemToList(sessionUserId, itemId, targetListId, sourceListId);
    if (!result.ok) {
      if (result.reason === "duplicate") {
        notify.alreadyExists();
      } else if (result.reason === "same_list") {
        notify.error(errorMessages.LIST_MOVE_SAME_LIST);
      } else {
        notify.error(errorMessages.LIST_MOVE_FAILED);
      }
      return false;
    }
    return true;
  };

  const handleCopyItem = (itemId: string, targetListId: string, sourceListId: string) => {
    const result = copyItemToList(sessionUserId, itemId, targetListId, sourceListId);
    if (!result.ok) {
      if (result.reason === "duplicate") {
        notify.alreadyExists();
      } else if (result.reason === "same_list") {
        notify.error(errorMessages.LIST_COPY_SAME_LIST);
      } else {
        notify.error(errorMessages.LIST_COPY_FAILED);
      }
      return false;
    }
    return true;
  };

  const confirmClearChecked = (onConfirm: () => void) => {
    setConfirmDialog({
      title: "Limpar itens marcados?",
      message: "Todos os itens já marcados como comprados serão removidos da lista.",
      confirmText: "Limpar marcados",
      danger: true,
      onConfirm: () => {
        onConfirm();
        notify.success("Itens comprados removidos!");
      },
    });
  };

  const confirmClearAll = (onConfirm: () => void) => {
    setConfirmDialog({
      title: "Limpar lista completa?",
      message: "Esta ação remove todos os itens da lista atual e não pode ser desfeita.",
      confirmText: "Limpar lista",
      danger: true,
      onConfirm: () => {
        onConfirm();
        notify.success("Lista limpa!");
      },
    });
  };

  const confirmDeleteList = (listId: string, listName: string, listsCount: number) => {
    setConfirmDialog({
      title: "Excluir lista?",
      message:
        listsCount <= 1
          ? "Você precisa ter pelo menos uma lista."
          : `A lista "${listName}" e seus itens serão removidos.`,
      confirmText: "Excluir lista",
      danger: true,
      onConfirm: () => {
        handleDeleteList(listId, listName, listsCount);
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
    handleRenameList,
    handleDeleteList,
    handleAddItem,
    handleToggleItem,
    handleRemoveItem,
    handleClearChecked,
    handleClearAll,
    handleMoveItem,
    handleCopyItem,
    confirmClearChecked,
    confirmClearAll,
    confirmDeleteList,
    closeConfirm,
  };
}
