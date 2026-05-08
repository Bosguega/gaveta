import { useMemo, useState, type FormEvent } from "react";
import { ListChecks, Plus, Eraser, Trash2, Pencil } from "lucide-react";
import { notify } from "../../utils/notifications";
import { useAllReceiptsQuery } from "../../hooks/queries/useReceiptsQuery";
import { useReceiptsSessionStore } from "../../stores/useReceiptsSessionStore";
import { useShoppingListStore } from "../../stores/useShoppingListStore";
import { useLocalShoppingListActions } from "../../hooks/shoppingList/useLocalShoppingListActions";
import { useSortedShoppingItems } from "../../hooks/queries/useSortedShoppingItems";
import { usePurchaseHistory, type PurchaseHistoryEntry } from "../../hooks/queries/usePurchaseHistory";
import { useCanonicalProductsQuery } from "../../hooks/queries/useCanonicalProductsQuery";
import { sanitizeShoppingList, toText } from "../../utils/shoppingList";
import { normalizeKey } from "../../utils/normalize";
import { filterBySearch } from "../../utils/filters";
import { scoreHistoryKeyMatch } from "../../utils/shoppingHistoryMatch";
import { ShoppingListItem } from "../ShoppingListItem";
import ConfirmDialog from "../ConfirmDialog";
import InputDialog from "../InputDialog";
import type {
  ShoppingListItem as ShoppingListItemType,
} from "../../types/ui";

const EMPTY_SHOPPING_ITEMS: ShoppingListItemType[] = [];
type HistoryMatchType = "exact" | "approx" | "none";
type ListInputDialogState =
  | { mode: "create"; initialValue: string }
  | { mode: "rename"; initialValue: string }
  | null;

interface LocalShoppingListTabProps {
  onSwitchToCollab?: () => void;
}

/**
 * Componente de Lista de Compras Local
 * Gerencia listas de compras armazenadas localmente no dispositivo
 */
export function LocalShoppingListTab({ onSwitchToCollab: _onSwitchToCollab }: LocalShoppingListTabProps) {
  const sessionUserId = useReceiptsSessionStore((state) => state.sessionUserId);
  const { data: savedReceipts = [] } = useAllReceiptsQuery();
  const { data: canonicalProducts = [] } = useCanonicalProductsQuery();

  const lists = useShoppingListStore((state) => state.getLists(sessionUserId));
  const activeListId = useShoppingListStore((state) => state.getActiveListId(sessionUserId));
  const rawShoppingItems = useShoppingListStore((state) =>
    state.getItems(sessionUserId, activeListId),
  );

  const shoppingItems = useMemo(
    () => sanitizeShoppingList(rawShoppingItems || EMPTY_SHOPPING_ITEMS),
    [rawShoppingItems],
  );

  const setActiveList = useShoppingListStore((state) => state.setActiveList);
  const orderedItems = useSortedShoppingItems(shoppingItems);
  const [itemName, setItemName] = useState("");
  const [itemQty, setItemQty] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [transferTargetByItem, setTransferTargetByItem] = useState<Record<string, string>>({});
  const [listInputDialog, setListInputDialog] = useState<ListInputDialogState>(null);

  const { historyByKey, suggestions: allSuggestions } = usePurchaseHistory(savedReceipts, canonicalProducts);

  const suggestions = useMemo(() => {
    if (!itemName.trim()) return allSuggestions.slice(0, 50);
    return filterBySearch(allSuggestions, itemName, ["label", "category", "canonical_name"]).slice(0, 50);
  }, [allSuggestions, itemName]);

  const actions = useLocalShoppingListActions(sessionUserId);

  const activeLocalList = lists.find((list) => list.id === activeListId) || lists[0];
  const checkedCount = shoppingItems.filter((item) => item.checked).length;
  const pendingCount = shoppingItems.length - checkedCount;
  const listTransferOptions = lists.filter((list) => list.id !== activeListId);

  const getTransferTargetId = (itemId: string): string => {
    const selected = transferTargetByItem[itemId];
    if (selected && listTransferOptions.some((list) => list.id === selected)) {
      return selected;
    }
    return listTransferOptions[0]?.id || "";
  };

  const handleAddItem = async (event: FormEvent) => {
    event.preventDefault();
    const success = actions.handleAddItem(itemName, itemQty);
    if (success) {
      setItemName("");
      setItemQty("");
    }
  };

  const handleCreateList = () => {
    setListInputDialog({ mode: "create", initialValue: "" });
  };

  const handleRenameList = () => {
    if (!activeLocalList) return;
    setListInputDialog({ mode: "rename", initialValue: activeLocalList.name });
  };

  const handleConfirmListInput = async (rawValue: string) => {
    const trimmed = rawValue.trim();
    if (!trimmed) return;

    if (listInputDialog?.mode === "create") {
      const success = actions.handleCreateList(trimmed);
      if (success) setListInputDialog(null);
      return;
    }

    if (listInputDialog?.mode === "rename" && activeLocalList) {
      const success = actions.handleRenameList(activeLocalList.id, trimmed);
      if (success) setListInputDialog(null);
    }
  };

  const getRecentHistory = (
    item: ShoppingListItemType,
  ): { entries: PurchaseHistoryEntry[]; matchType: HistoryMatchType } => {
    const safeKey = normalizeKey(toText(item.normalized_key).trim() || item.name);
    if (!safeKey) return { entries: [], matchType: "none" };

    const exact = historyByKey.get(safeKey);
    if (exact && exact.length > 0) return { entries: exact.slice(0, 3), matchType: "exact" };

    const fallback: Array<{ entry: PurchaseHistoryEntry; score: number }> = [];
    for (const [key, entries] of historyByKey.entries()) {
      const match = scoreHistoryKeyMatch(safeKey, key);
      if (match.score > 0) {
        for (const entry of entries.slice(0, 2)) {
          fallback.push({ entry, score: match.score });
        }
      }
    }

    fallback.sort((a, b) => b.score - a.score || b.entry.timestamp - a.entry.timestamp);
    const entries = fallback.slice(0, 3).map((candidate) => candidate.entry);
    return {
      entries,
      matchType: entries.length > 0 ? "approx" : "none",
    };
  };

  return (
    <div>
      <div className="shopping-section-header">
        <div>
          <h2 className="section-title mb-1">
            <ListChecks size={20} color="var(--primary)" />
            Lista de Compras Local
          </h2>
          <p className="text-[0.8rem] text-slate-500 ml-7">
            {pendingCount} pendente(s) de {shoppingItems.length}
          </p>
        </div>

        <div className="shopping-icon-actions">
          <button
            className="btn px-[0.6rem] py-[0.45rem] bg-amber-500/15 shadow-none text-amber-500 hover:bg-amber-500/25"
            title="Limpar marcados"
            aria-label="Limpar itens marcados"
            onClick={() => actions.confirmClearChecked(actions.handleClearChecked)}
            disabled={checkedCount === 0}
          >
            <Eraser size={16} />
          </button>
          <button
            className="btn px-[0.6rem] py-[0.45rem] bg-red-500/15 shadow-none text-red-500 hover:bg-red-500/25"
            title="Limpar lista"
            aria-label="Limpar lista"
            onClick={() => actions.confirmClearAll(actions.handleClearAll)}
            disabled={shoppingItems.length === 0}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div className="glass-card mb-4 p-3">
        <div className="shopping-list-toolbar">
          <select
            className="search-input"
            value={activeListId}
            onChange={(e) => setActiveList(sessionUserId, e.target.value)}
            aria-label="Selecionar lista ativa"
          >
            {lists.map((list) => (
              <option key={list.id} value={list.id}>
                {list.name}
              </option>
            ))}
          </select>
          <button className="btn px-[0.7rem] py-2" onClick={handleCreateList}>
            <Plus size={15} /> Nova
          </button>
          <button
            className="btn px-[0.7rem] py-2 bg-white/10 shadow-none hover:bg-white/20"
            onClick={handleRenameList}
            disabled={!activeLocalList}
          >
            <Pencil size={15} /> Renomear
          </button>
          <button
            className="btn px-[0.7rem] py-2 bg-red-500/10 shadow-none text-red-400 hover:bg-red-500/20"
            onClick={() =>
              activeLocalList && actions.confirmDeleteList(
                activeLocalList.id,
                activeLocalList.name,
                lists.length,
              )
            }
            disabled={!activeLocalList || lists.length <= 1}
          >
            <Trash2 size={15} /> Excluir
          </button>
        </div>
      </div>

      <form className="glass-card mb-4 relative z-20" onSubmit={handleAddItem}>
        <div className="shopping-add-form-row">
          <div className="relative">
            <input
              className="search-input"
              placeholder="Ex: Arroz, Leite, Cafe..."
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            />
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute left-0 right-0 z-[100] mt-2 bg-[#1e293b] border border-white/10 rounded-xl p-1 max-h-64 overflow-auto shadow-2xl animated-item">
                {suggestions.map((suggestion) => (
                  <div
                    key={suggestion.key}
                    className="p-3 hover:bg-white/10 cursor-pointer rounded-lg text-[0.9rem] text-slate-200 transition-colors flex justify-between items-center"
                    onClick={() => {
                      setItemName(suggestion.label);
                      setShowSuggestions(false);
                    }}
                  >
                    <div className="flex flex-col">
                      <span className="font-medium">{suggestion.label}</span>
                      {suggestion.category && (
                        <span className="text-[0.65rem] text-slate-500 uppercase tracking-wider">
                          {suggestion.category}
                        </span>
                      )}
                    </div>
                    {suggestion.count > 0 && (
                      <span className="text-[0.7rem] bg-blue-500/20 px-2 py-1 rounded text-blue-400 font-bold">
                        {suggestion.count}x
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          <input
            className="search-input"
            placeholder="Qtd"
            value={itemQty}
            onChange={(e) => setItemQty(e.target.value)}
          />
        </div>

        <button
          className="btn w-full"
          type="submit"
        >
          <Plus size={18} />
          Adicionar Item
        </button>
      </form>

      <div className="items-list gap-3.5">
        {orderedItems.length === 0 ? (
          <div className="glass-card text-center py-12 px-4">
            <ListChecks size={44} color="#334155" />
            <h3 className="text-slate-200 mt-3">Sua lista esta vazia</h3>
            <p className="text-slate-400 text-sm mt-1">
              Adicione itens para acompanhar o que falta pegar no mercado.
            </p>
          </div>
        ) : (
          orderedItems.map((item) => {
            const historyContext = getRecentHistory(item);
            return (
              <ShoppingListItem
                key={item.id}
                item={item}
                history={historyContext.entries}
                historyMatchType={historyContext.matchType}
                onToggle={() => actions.handleToggleItem(item.id)}
                onRemove={() => actions.handleRemoveItem(item.id)}
                transferOptions={listTransferOptions}
                transferTargetId={getTransferTargetId(item.id)}
                onTransferTargetChange={(targetListId) =>
                  setTransferTargetByItem((prev) => ({ ...prev, [item.id]: targetListId }))
                }
                onMoveToList={() => {
                  const targetListId = getTransferTargetId(item.id);
                  if (!targetListId) {
                    notify.error("Crie outra lista para mover itens.");
                    return;
                  }
                  const success = actions.handleMoveItem(item.id, targetListId, activeListId);
                  if (success) {
                    const destinationName = lists.find((list) => list.id === targetListId)?.name || "outra lista";
                    notify.success(`Item movido para "${destinationName}".`);
                  }
                }}
                onCopyToList={() => {
                  const targetListId = getTransferTargetId(item.id);
                  if (!targetListId) {
                    notify.error("Crie outra lista para copiar itens.");
                    return;
                  }
                  const success = actions.handleCopyItem(item.id, targetListId, activeListId);
                  if (success) {
                    const destinationName = lists.find((list) => list.id === targetListId)?.name || "outra lista";
                    notify.success(`Item copiado para "${destinationName}".`);
                  }
                }}
                currentUserId={sessionUserId}
              />
            );
          })
        )}
      </div>

      <ConfirmDialog
        isOpen={Boolean(actions.confirmDialog)}
        title={actions.confirmDialog?.title || ""}
        message={actions.confirmDialog?.message || ""}
        confirmText={actions.confirmDialog?.confirmText}
        cancelText={actions.confirmDialog?.cancelText}
        danger={actions.confirmDialog?.danger}
        busy={false}
        onCancel={actions.closeConfirm}
        onConfirm={async () => {
          await actions.confirmDialog?.onConfirm?.();
          actions.closeConfirm();
        }}
      />

      <InputDialog
        isOpen={Boolean(listInputDialog)}
        title={listInputDialog?.mode === "rename" ? "Renomear lista" : "Nova lista"}
        message={
          listInputDialog?.mode === "rename"
            ? "Informe o novo nome da lista."
            : "Informe o nome da nova lista."
        }
        placeholder="Nome da lista"
        initialValue={listInputDialog?.initialValue || ""}
        confirmText={listInputDialog?.mode === "rename" ? "Renomear" : "Criar"}
        onCancel={() => setListInputDialog(null)}
        onConfirm={handleConfirmListInput}
      />
    </div>
  );
}
