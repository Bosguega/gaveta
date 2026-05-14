import React, { useMemo, useState, useCallback } from "react";
import type { FormEvent } from "react";
import { ListChecks, Plus, Eraser, Trash2, Share2, ChevronDown, ChevronUp, Pencil } from "lucide-react";
import { notify } from "../../utils/notifications";
import { useAllReceiptsQuery } from "../../hooks/queries/useReceiptsQuery";
import { useReceiptsSessionStore } from "../../stores/useReceiptsSessionStore";
import { useShoppingListStore } from "../../stores/useShoppingListStore";
import { useLocalShoppingListActions } from "../../hooks/shoppingList/useLocalShoppingListActions";
import { useSharedListImport } from "../../hooks/useSharedListImport";
import { saveSharedSnapshot, shareList } from "../../utils/shareService";
import { useSortedShoppingItems } from "../../hooks/queries/useSortedShoppingItems";
import { usePurchaseHistory } from "../../hooks/queries/usePurchaseHistory";
import type { PurchaseHistoryEntry } from "../../hooks/queries/usePurchaseHistory";
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
  ShoppingListMeta,
} from "../../types/ui";

const EMPTY_SHOPPING_ITEMS: ShoppingListItemType[] = [];
type HistoryMatchType = "exact" | "approx" | "none";
type ListInputDialogState =
  | { mode: "create"; initialValue: string }
  | { mode: "rename"; initialValue: string }
  | null;

/**
 * Componente principal da Lista de Compras.
 *
 * Layout com cards expansíveis no estilo do ReceiptCard.
 * Input de adicionar itens sempre visível no topo.
 */
export default function ShoppingListTab() {
  // Detecta lista compartilhada na URL
  useSharedListImport();

  const sessionUserId = useReceiptsSessionStore((state) => state.sessionUserId);
  const { data: savedReceipts = [] } = useAllReceiptsQuery();
  const { data: canonicalProducts = [] } = useCanonicalProductsQuery();

  const lists = useShoppingListStore((state) => state.getLists(sessionUserId));
  const activeListId = useShoppingListStore((state) => state.getActiveListId(sessionUserId));
  const setActiveList = useShoppingListStore((state) => state.setActiveList);

  // Estado: quais listas estão expandidas (ativa sempre expandida)
  const [expandedListIds, setExpandedListIds] = useState<Set<string>>(new Set([activeListId]));

  const [itemName, setItemName] = useState("");
  const [itemQty, setItemQty] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [transferTargetByItem, setTransferTargetByItem] = useState<Record<string, string>>({});
  const [listInputDialog, setListInputDialog] = useState<ListInputDialogState>(null);

  // Buscar dados de histórico
  const { historyByKey, suggestions: allSuggestions } = usePurchaseHistory(savedReceipts, canonicalProducts);

  const suggestions = useMemo(() => {
    if (!itemName.trim()) return allSuggestions.slice(0, 50);
    return filterBySearch(allSuggestions, itemName, ["label", "category", "canonical_name"]).slice(0, 50);
  }, [allSuggestions, itemName]);

  const actions = useLocalShoppingListActions(sessionUserId);

  const activeLocalList = lists.find((list) => list.id === activeListId) || lists[0];
  const listTransferOptions = lists.filter((list) => list.id !== activeListId);

  // Toggle expansão de lista
  const toggleExpandList = useCallback((listId: string) => {
    setExpandedListIds((prev) => {
      const next = new Set(prev);
      if (next.has(listId)) {
        next.delete(listId);
      } else {
        next.add(listId);
      }
      return next;
    });
  }, []);

  const handleShare = useCallback(async () => {
    const snapshot = useShoppingListStore.getState().getCloudSnapshot(sessionUserId);
    if (!snapshot) {
      notify.error("Nenhuma lista para compartilhar.");
      return;
    }

    try {
      const shareId = saveSharedSnapshot(snapshot);
      const result = await shareList(shareId);

      if (result === "shared") {
        notify.success("Lista compartilhada!");
      } else if (result === "copied") {
        notify.success("Link copiado! Envie para quem quiser.");
      } else {
        notify.error("Não foi possível compartilhar.");
      }
    } catch {
      notify.error("Erro ao compartilhar lista.");
    }
  }, [sessionUserId]);

  const handleAddItem = async (event: FormEvent) => {
    event.preventDefault();
    const success = actions.handleAddItem(itemName, itemQty);
    if (success) {
      setItemName("");
      setItemQty("");
    }
  };

  const handleCreateList = () => {
    // Nome automático baseado em data
    const now = new Date();
    const day = String(now.getDate()).padStart(2, "0");
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const name = `Compras ${day}/${month}`;
    const success = actions.handleCreateList(name);
    if (!success) {
      // Se já existe "Compras 14/05", adiciona um sufixo
      const fallbackName = `Compras ${day}/${month} (${lists.length + 1})`;
      actions.handleCreateList(fallbackName);
    }
  };

  const handleRenameList = () => {
    if (!activeLocalList) return;
    setListInputDialog({ mode: "rename", initialValue: activeLocalList.name });
  };

  const handleConfirmListInput = async (rawValue: string) => {
    const trimmed = rawValue.trim();
    if (!trimmed) return;

    if (listInputDialog?.mode === "rename" && activeLocalList) {
      const success = actions.handleRenameList(activeLocalList.id, trimmed);
      if (success) setListInputDialog(null);
    }
  };

  // Obter histórico de um item
  const getItemHistory = useCallback(
    (item: ShoppingListItemType): { entries: PurchaseHistoryEntry[]; matchType: HistoryMatchType } => {
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
    },
    [historyByKey],
  );

  // Contar itens pendentes de cada lista
  const getListCounts = useMemo(() => {
    const counts: Record<string, { total: number; pending: number }> = {};
    for (const list of lists) {
      const items = useShoppingListStore.getState().getItems(sessionUserId, list.id);
      const sanitized = sanitizeShoppingList(items || EMPTY_SHOPPING_ITEMS);
      counts[list.id] = {
        total: sanitized.length,
        pending: sanitized.filter((i) => !i.checked).length,
      };
    }
    return counts;
  }, [lists, sessionUserId]);

  const checkedCount = (getListCounts[activeListId]?.total ?? 0) - (getListCounts[activeListId]?.pending ?? 0);

  return (
    <div>
      {/* Header simplificado */}
      <div className="shopping-section-header">
        <div>
          <h2 className="section-title mb-1">
            <ListChecks size={20} color="var(--primary)" />
            Lista de Compras
          </h2>
        </div>

        <div className="shopping-icon-actions">
          <button
            className="btn px-[0.6rem] py-[0.45rem] bg-sky-500/15 shadow-none text-sky-400 hover:bg-sky-500/25"
            title="Compartilhar lista"
            aria-label="Compartilhar lista"
            onClick={handleShare}
          >
            <Share2 size={16} />
          </button>
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
            disabled={getListCounts[activeListId]?.total === 0}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Input de adicionar item - SEMPRE visível no topo */}
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
                {suggestions.map((suggestion) => {
                  const lastPrice = suggestion.lastPrice ?? 0;
                  return (
                    <div
                      key={suggestion.key}
                      className="p-3 hover:bg-white/10 cursor-pointer rounded-lg text-[0.9rem] text-slate-200 transition-colors"
                      onClick={() => {
                        setItemName(suggestion.label);
                        setShowSuggestions(false);
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col min-w-0 flex-1">
                          <span className="font-medium truncate">
                            {suggestion.canonical_name || suggestion.label}
                          </span>
                          <div className="flex items-center gap-2 text-[0.7rem] text-slate-400 mt-0.5">
                            {suggestion.category && (
                              <span className="uppercase tracking-wider">{suggestion.category}</span>
                            )}
                            {lastPrice > 0 && (
                              <span className="text-emerald-400 font-medium">
                                R$ {lastPrice.toFixed(2)}
                              </span>
                            )}
                            {suggestion.lastStore && (
                              <span className="truncate">{suggestion.lastStore}</span>
                            )}
                          </div>
                        </div>
                        {suggestion.count > 0 && (
                          <span className="shrink-0 text-[0.7rem] bg-blue-500/20 px-2 py-1 rounded text-blue-400 font-bold ml-2">
                            {suggestion.count}x
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
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

        <button className="btn w-full" type="submit">
          <Plus size={18} />
          Adicionar Item
        </button>
      </form>

      {/* Botão Nova lista + Renomear */}
      <div className="flex items-center gap-2 mb-4">
        <button className="btn px-3 py-2 text-sm flex items-center gap-1.5" onClick={handleCreateList}>
          <Plus size={15} /> Nova lista
        </button>
        <button
          className="btn px-3 py-2 text-sm bg-white/10 shadow-none hover:bg-white/20 flex items-center gap-1.5"
          onClick={handleRenameList}
          disabled={!activeLocalList}
        >
          <Pencil size={14} /> Renomear
        </button>
      </div>

      {/* Cards de listas */}
      <div className="items-list gap-3.5">
        {lists.length === 0 ? (
          <div className="glass-card text-center py-12 px-4">
            <ListChecks size={44} color="#334155" />
            <h3 className="text-slate-200 mt-3">Nenhuma lista ainda</h3>
            <p className="text-slate-400 text-sm mt-1">
              Crie uma nova lista para começar.
            </p>
          </div>
        ) : (
          lists.map((listMeta) => (
            <ListCardWithData
              key={listMeta.id}
              listMeta={listMeta}
              isActive={listMeta.id === activeListId}
              isExpanded={expandedListIds.has(listMeta.id) || listMeta.id === activeListId}
              sessionUserId={sessionUserId}
              listTransferOptions={listTransferOptions}
              transferTargetByItem={transferTargetByItem}
              counts={getListCounts[listMeta.id] || { total: 0, pending: 0 }}
              getItemHistory={getItemHistory}
              actions={actions}
              onChangeActive={(id) => {
                setActiveList(sessionUserId, id);
                toggleExpandList(id);
              }}
              onToggleExpand={(id) => toggleExpandList(id)}
              onTransferTargetChange={(itemId, targetListId) =>
                setTransferTargetByItem((prev) => ({ ...prev, [itemId]: targetListId }))
              }
            />
          ))
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
        title="Renomear lista"
        message="Informe o novo nome da lista."
        placeholder="Nome da lista"
        initialValue={listInputDialog?.initialValue || ""}
        confirmText="Renomear"
        onCancel={() => setListInputDialog(null)}
        onConfirm={handleConfirmListInput}
      />
    </div>
  );
}

// =========================
// ListCardWithData - Subcomponente que busca dados da store e renderiza o card
// =========================

interface ListCardWithDataProps {
  listMeta: ShoppingListMeta;
  isActive: boolean;
  isExpanded: boolean;
  sessionUserId: string | null | undefined;
  listTransferOptions: ShoppingListMeta[];
  transferTargetByItem: Record<string, string>;
  counts: { total: number; pending: number };
  getItemHistory: (item: ShoppingListItemType) => { entries: PurchaseHistoryEntry[]; matchType: HistoryMatchType };
  actions: ReturnType<typeof useLocalShoppingListActions>;
  onChangeActive: (listId: string) => void;
  onToggleExpand: (listId: string) => void;
  onTransferTargetChange: (itemId: string, targetListId: string) => void;
}

function ListCardWithData({
  listMeta,
  isActive,
  isExpanded,
  sessionUserId,
  listTransferOptions,
  transferTargetByItem,
  counts,
  getItemHistory,
  actions,
  onChangeActive,
  onToggleExpand,
  onTransferTargetChange,
}: ListCardWithDataProps) {
  const rawItems = useShoppingListStore((state) => state.getItems(sessionUserId, listMeta.id));
  const listItems = useMemo(
    () => sanitizeShoppingList(rawItems || EMPTY_SHOPPING_ITEMS),
    [rawItems],
  );
  const orderedItems = useSortedShoppingItems(listItems);

  return (
    <div
      className={`glass-card animated-item p-0 overflow-hidden mb-0 ${isActive ? "ring-1 ring-blue-500/30" : ""
        }`}
    >
      {/* Cabeçalho do card - clicável para expandir */}
      <div
        onClick={() => {
          if (!isExpanded) {
            onChangeActive(listMeta.id);
          }
          onToggleExpand(listMeta.id);
        }}
        className="p-4 cursor-pointer relative"
      >
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <ListChecks size={18} color="var(--primary)" className="shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-slate-50 text-[1rem] truncate">
                  {listMeta.name}
                </h3>
                {isActive && (
                  <span className="text-[0.6rem] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded-full font-medium shrink-0">
                    Ativa
                  </span>
                )}
              </div>
              <div className="flex gap-3 items-center mt-0.5">
                <span className="text-slate-400 text-xs">
                  {counts.total} {counts.total === 1 ? "item" : "itens"}
                </span>
                {counts.pending > 0 && (
                  <span className="text-amber-400 text-xs">
                    {counts.pending} pendente(s)
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {!isExpanded && counts.pending > 0 && (
              <span className="bg-amber-500/20 text-amber-400 text-[0.65rem] px-2 py-0.5 rounded-full font-bold">
                {counts.pending}
              </span>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                actions.confirmDeleteList(listMeta.id, listMeta.name, 0);
              }}
              className="bg-red-500/10 border-none rounded-lg w-7 h-7 flex items-center justify-center text-red-500 cursor-pointer hover:bg-red-500/20"
              title="Excluir lista"
            >
              <Trash2 size={14} />
            </button>
            <div className="text-slate-500">
              {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </div>
          </div>
        </div>
      </div>

      {/* Conteúdo expandido */}
      {isExpanded && (
        <div className="border-t border-white/5 px-4 pb-4 pt-0">
          {orderedItems.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-4">
              Nenhum item ainda. Adicione itens no campo acima.
            </p>
          ) : (
            orderedItems.map((item) => {
              const historyContext = getItemHistory(item);
              return (
                <ShoppingListItem
                  key={item.id}
                  item={item}
                  history={historyContext.entries}
                  historyMatchType={historyContext.matchType}
                  onToggle={() => actions.handleToggleItem(item.id)}
                  onRemove={() => actions.handleRemoveItem(item.id)}
                  transferOptions={listTransferOptions}
                  transferTargetId={
                    transferTargetByItem[item.id] || listTransferOptions[0]?.id || ""
                  }
                  onTransferTargetChange={(targetListId) =>
                    onTransferTargetChange(item.id, targetListId)
                  }
                  onMoveToList={() => {
                    const targetListId = transferTargetByItem[item.id];
                    if (!targetListId || !listTransferOptions.some((l) => l.id === targetListId)) {
                      notify.error("Crie outra lista para mover itens.");
                      return;
                    }
                    const success = actions.handleMoveItem(item.id, targetListId, listMeta.id);
                    if (success) {
                      const destinationName = listTransferOptions.find((l) => l.id === targetListId)?.name || "outra lista";
                      notify.success(`Item movido para "${destinationName}".`);
                    }
                  }}
                  onCopyToList={() => {
                    const targetListId = transferTargetByItem[item.id];
                    if (!targetListId || !listTransferOptions.some((l) => l.id === targetListId)) {
                      notify.error("Crie outra lista para copiar itens.");
                      return;
                    }
                    const success = actions.handleCopyItem(item.id, targetListId, listMeta.id);
                    if (success) {
                      const destinationName = listTransferOptions.find((l) => l.id === targetListId)?.name || "outra lista";
                      notify.success(`Item copiado para "${destinationName}".`);
                    }
                  }}
                  currentUserId={sessionUserId}
                />
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
