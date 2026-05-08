import { useMemo, useState, type FormEvent } from "react";
import { notify } from "../../../utils/notifications";
import { useReceiptsSessionStore } from "../../../stores/useReceiptsSessionStore";
import { useCollaborativeShoppingListActions } from "../../../hooks/shoppingList/useCollaborativeShoppingListActions";
import {
  useCollaborativeListItemsQuery,
  useCollaborativeListMembersQuery,
  useCollaborativeListRealtime,
  useCollaborativeListsQuery,
} from "../../../hooks/queries/useCollaborativeShoppingListsQuery";
import { useSortedShoppingItems } from "../../../hooks/queries/useSortedShoppingItems";
import { useAllReceiptsQuery } from "../../../hooks/queries/useReceiptsQuery";
import { useCanonicalProductsQuery } from "../../../hooks/queries/useCanonicalProductsQuery";
import { usePurchaseHistory } from "../../../hooks/queries/usePurchaseHistory";
import { filterBySearch } from "../../../utils/filters";
import type { ShoppingListItem as ShoppingListItemType } from "../../../types/ui";
import type { CollaborativeShoppingListItem } from "../../../types/domain";

export type CollabInputDialogState =
  | { mode: "create"; initialValue: string }
  | { mode: "rename"; initialValue: string }
  | { mode: "join"; initialValue: string }
  | null;

function toUiItem(item: CollaborativeShoppingListItem): ShoppingListItemType {
  return {
    id: item.id,
    name: item.name,
    normalized_key: item.normalized_key,
    quantity: item.quantity || undefined,
    checked: item.checked,
    created_at: item.created_at,
    checked_at: item.checked_at || undefined,
    checked_by_user_id: item.checked_by_user_id || undefined,
  };
}

export function useCollaborativeTabController() {
  const sessionUserId = useReceiptsSessionStore((state) => state.sessionUserId);
  const isAuthenticated = Boolean(sessionUserId);

  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [itemName, setItemName] = useState("");
  const [itemQty, setItemQty] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [collabInputDialog, setCollabInputDialog] = useState<CollabInputDialogState>(null);

  const collaborativeListsQuery = useCollaborativeListsQuery(isAuthenticated);
  const collaborativeLists = useMemo(
    () => collaborativeListsQuery.data || [],
    [collaborativeListsQuery.data],
  );

  const activeList = useMemo(
    () =>
      collaborativeLists.find((entry) => entry.id === activeListId) ||
      collaborativeLists[0] ||
      null,
    [activeListId, collaborativeLists],
  );

  const collaborativeItemsQuery = useCollaborativeListItemsQuery(
    activeList?.id || null,
    isAuthenticated,
  );
  const collaborativeMembersQuery = useCollaborativeListMembersQuery(
    activeList?.id || null,
    isAuthenticated,
  );

  useCollaborativeListRealtime(activeList?.id || null, isAuthenticated);

  const collaborativeItems = useMemo(
    () => (collaborativeItemsQuery.data || []).map(toUiItem),
    [collaborativeItemsQuery.data],
  );
  const collaborativeMembers = collaborativeMembersQuery.data || [];
  const orderedItems = useSortedShoppingItems(collaborativeItems);

  // Sugestões para o input
  const { data: savedReceipts = [] } = useAllReceiptsQuery();
  const { data: canonicalProducts = [] } = useCanonicalProductsQuery();
  const { suggestions: allSuggestions } = usePurchaseHistory(savedReceipts, canonicalProducts);

  const suggestions = useMemo(() => {
    if (!itemName.trim()) return allSuggestions.slice(0, 50);
    return filterBySearch(allSuggestions, itemName, ["label", "category", "canonical_name"]).slice(0, 50);
  }, [allSuggestions, itemName]);

  const actions = useCollaborativeShoppingListActions(sessionUserId);

  const checkedCount = collaborativeItems.filter((item) => item.checked).length;
  const pendingCount = collaborativeItems.length - checkedCount;

  const handleAddItem = async (event: FormEvent) => {
    event.preventDefault();
    if (!activeList?.id) {
      notify.error("Crie ou entre em uma lista colaborativa primeiro.");
      return;
    }
    const success = await actions.handleAddItem(activeList.id, itemName, itemQty);
    if (success) {
      setItemName("");
      setItemQty("");
    }
  };

  const handleCreateList = () => {
    setCollabInputDialog({ mode: "create", initialValue: "" });
  };

  const handleRenameList = () => {
    if (!activeList) return;
    setCollabInputDialog({ mode: "rename", initialValue: activeList.name });
  };

  const handleJoinByCode = () => {
    setCollabInputDialog({ mode: "join", initialValue: "" });
  };

  const handleConfirmCollabInput = async (rawValue: string) => {
    const trimmed = rawValue.trim();
    if (!trimmed) return;

    if (collabInputDialog?.mode === "create") {
      const created = await actions.handleCreateList(trimmed);
      if (created) {
        setActiveListId(created.id);
        setCollabInputDialog(null);
      }
      return;
    }

    if (collabInputDialog?.mode === "rename" && activeList) {
      const success = await actions.handleRenameList(activeList.id, trimmed);
      if (success) setCollabInputDialog(null);
      return;
    }

    if (collabInputDialog?.mode === "join") {
      const joined = await actions.handleJoinByCode(trimmed);
      if (joined) {
        setActiveListId(joined.id);
        setCollabInputDialog(null);
      }
    }
  };

  return {
    sessionUserId,
    isAuthenticated,
    activeList,
    activeListId,
    setActiveListId,
    collaborativeLists,
    collaborativeItems,
    collaborativeMembers,
    orderedItems,
    suggestions,
    itemName,
    setItemName,
    showSuggestions,
    setShowSuggestions,
    itemQty,
    setItemQty,
    collabInputDialog,
    setCollabInputDialog,
    actions,
    checkedCount,
    pendingCount,
    handleAddItem,
    handleCreateList,
    handleRenameList,
    handleJoinByCode,
    handleConfirmCollabInput,
  };
}
