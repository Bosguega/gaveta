import { useEffect, useMemo, useState } from "react";
import { Book, RotateCcw, Save, X } from "lucide-react";
import { toast, type Toast } from "react-hot-toast";
import { notify } from "../utils/notifications";
import { logger } from "../utils/logger";
import { CATEGORIES } from "../constants/domain";
import { DictionaryRow } from "./DictionaryRow";
import UniversalSearchBar from "./UniversalSearchBar";
import ConfirmDialog from "./ConfirmDialog";
import { Skeleton } from "./Skeleton";
import { filterBySearch, sortItems, SEARCH_CONFIG } from "../utils/filters";
import type { ConfirmDialogConfig, SortDirection } from "../types/ui";
import type { DictionaryEntry } from "../types/domain";
import { useAllReceiptsQuery } from "../hooks/queries/useReceiptsQuery";
import { useCanonicalProductsQuery } from "../hooks/queries/useCanonicalProductsQuery";
import {
  useApplyDictionaryEntryToSavedItems,
  useClearDictionary,
  useDeleteDictionaryEntry,
  useDictionaryQuery,
  useUpdateDictionaryEntry,
} from "../hooks/queries/useDictionaryQuery";

function DictionaryTab() {
  const PAGE_SIZE = 100;
  const { refetch: refetchReceipts } = useAllReceiptsQuery();
  const { data: products = [] } = useCanonicalProductsQuery();
  const { data: dictionary = [], isLoading: loading } = useDictionaryQuery();
  const updateDictionaryEntry = useUpdateDictionaryEntry();
  const deleteDictionaryEntry = useDeleteDictionaryEntry();
  const clearDictionary = useClearDictionary();
  const applyDictionaryChanges = useApplyDictionaryEntryToSavedItems();

  const [searchQuery, setSearchQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [sortBy, setSortBy] = useState("recent");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    normalized_name: "",
    category: "",
    canonical_product_id: "",
  });
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogConfig | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const closeConfirm = () => {
    confirmDialog?.onCancel?.();
    setConfirmDialog(null);
    setConfirmBusy(false);
  };

  const runConfirm = async () => {
    if (!confirmDialog) return;
    setConfirmBusy(true);
    try {
      await confirmDialog.onConfirm();
      setConfirmDialog(null);
    } finally {
      setConfirmBusy(false);
    }
  };

  const applyChangesToSavedReceipts = async (
    key: string,
    normalizedName: string,
    category: string,
  ) => {
    const toastId = notify.loading("Atualizando notas salvas...");
    try {
      const { updatedCount } = await applyDictionaryChanges.mutateAsync({
        key,
        normalizedName,
        category,
      });

      refetchReceipts();

      if (!updatedCount) {
        notify.dismiss(toastId);
        notify.success("Nenhum item salvo precisou ser atualizado.");
      } else {
        notify.dismiss(toastId);
        notify.success(`Atualizado em ${updatedCount} item(ns) nas notas salvas.`);
      }
    } catch (err) {
      logger.error("DictionaryTab", "Erro ao aplicar correcao nas notas", err);
      notify.dismiss(toastId);
      notify.error("Erro ao atualizar notas salvas.");
    }
  };

  const handleStartEdit = (item: DictionaryEntry) => {
    setEditingKey(item.key);
    setEditForm({
      normalized_name: item.normalized_name || "",
      category: item.category || "Outros",
      canonical_product_id: item.canonical_product_id || "",
    });
  };

  const handleSaveEdit = async (key: string) => {
    try {
      const previous = dictionary.find((item) => item.key === key);
      const previousNormalizedName = (previous?.normalized_name ?? "").trim();
      const previousCategory = (previous?.category ?? "Outros").trim();

      const nextNormalizedName = (editForm.normalized_name ?? "").trim();
      const nextCategory = (editForm.category ?? "Outros").trim();
      const nextCanonicalId = editForm.canonical_product_id || null;

      const shouldOfferApplyToSaved =
        previousNormalizedName !== nextNormalizedName ||
        previousCategory !== nextCategory ||
        (previous?.canonical_product_id ?? null) !== nextCanonicalId;

      await updateDictionaryEntry.mutateAsync({
        key,
        normalizedName: nextNormalizedName,
        category: nextCategory,
        canonicalProductId: nextCanonicalId,
      });

      setEditingKey(null);
      notify.success("Item atualizado!");

      if (shouldOfferApplyToSaved) {
        toast(
          (t: Toast) => (
            <div className="glass-card m-0 p-4 w-full max-w-[520px] flex gap-3 items-center">
              <div className="flex-1">
                <div className="text-white font-bold mb-1">
                  Corrigir notas ja salvas?
                </div>
                <div className="text-slate-400 text-[0.85rem] leading-[1.35]">
                  Aplica este nome/categoria em todos os itens salvos com a chave{" "}
                  <strong className="text-slate-200">{key}</strong>.
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <button
                  className="btn btn-success py-2 px-[0.9rem] rounded-[0.9rem] text-[0.9rem]"
                  onClick={async () => {
                    toast.dismiss(t.id);
                    await applyChangesToSavedReceipts(
                      key,
                      nextNormalizedName,
                      nextCategory,
                    );
                  }}
                >
                  Corrigir
                </button>
                <button
                  className="btn py-2 px-[0.9rem] rounded-[0.9rem] text-[0.9rem] bg-white/5 shadow-none"
                  onClick={() => toast.dismiss(t.id)}
                >
                  Agora nao
                </button>
              </div>
            </div>
          ),
          { duration: 10000 },
        );
      }
    } catch (err) {
      logger.error("DictionaryTab", "Erro ao atualizar item", err);
      notify.error("Erro ao salvar alteracoes.");
    }
  };

  const handleDeleteEntry = async (key: string) => {
    setConfirmDialog({
      title: "Remover item?",
      message: "Essa acao remove o item do dicionario.",
      confirmText: "Remover",
      danger: true,
      onConfirm: async () => {
        try {
          await deleteDictionaryEntry.mutateAsync(key);
          notify.success("Item removido!");
        } catch (err) {
          logger.error("DictionaryTab", "Erro ao remover item", err);
          notify.error("Erro ao remover item.");
        }
      },
    });
  };

  const handleClearDictionary = async () => {
    setConfirmDialog({
      title: "Limpar dicionario?",
      message: "Isso apagara todo o dicionario de produtos e a IA precisara reaprender.",
      confirmText: "Limpar tudo",
      danger: true,
      onConfirm: async () => {
        try {
          await clearDictionary.mutateAsync();
          notify.success("Dicionario limpo com sucesso!");
        } catch (err) {
          logger.error("DictionaryTab", "Erro ao limpar dicionario", err);
          notify.error("Erro ao limpar dicionario.");
        }
      },
    });
  };

  const filteredDictionary = useMemo(() => {
    const baseItems = filterBySearch(dictionary, searchQuery, SEARCH_CONFIG.dictionary);
    return baseItems.filter(
      (item) => selectedCategory === "all" || item.category === selectedCategory,
    );
  }, [dictionary, searchQuery, selectedCategory]);

  const sortedDictionary = useMemo(() => {
    const customSorters = {
      recent: (a: DictionaryEntry, b: DictionaryEntry) => {
        const dateA = new Date(a.created_at || 0);
        const dateB = new Date(b.created_at || 0);
        return dateA.getTime() - dateB.getTime();
      },
      alpha: (a: DictionaryEntry, b: DictionaryEntry) => {
        const nameA = (a.normalized_name || a.key).toLowerCase();
        const nameB = (b.normalized_name || b.key).toLowerCase();
        return nameA.localeCompare(nameB);
      },
    };

    const sorted = sortItems(filteredDictionary, sortBy, sortDirection, customSorters);

    return {
      items: sorted,
      totalCount: sorted.length,
    };
  }, [filteredDictionary, sortBy, sortDirection]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [searchQuery, selectedCategory, sortBy, sortDirection]);

  const visibleItems = useMemo(
    () => sortedDictionary.items.slice(0, visibleCount),
    [sortedDictionary.items, visibleCount],
  );
  const hasMore = visibleItems.length < sortedDictionary.totalCount;

  return (
    <>
      <div className="dictionary-tab">
        <div className="flex justify-between items-center mb-5">
          <h2 className="section-title mb-0">
            <Book color="var(--primary)" size={20} />
            Dicionario
          </h2>
          <button
            className="btn bg-red-500/10 border-none text-red-400 p-2 rounded-lg"
            onClick={handleClearDictionary}
            title="Limpar Dicionario"
          >
            <RotateCcw size={20} />
          </button>
        </div>

        <UniversalSearchBar
          placeholder="Pesquisar no dicionario..."
          value={searchQuery}
          onChange={setSearchQuery}
          sortValue={sortBy}
          onSortChange={setSortBy}
          sortOrder={sortDirection}
          onSortOrderChange={setSortDirection}
          sortOptions={[
            { value: "recent", label: "RECENTE" },
            { value: "alpha", label: "A-Z" },
          ]}
          extraActions={
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 font-medium">
                  CATEGORIA:
                </span>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="bg-blue-500/10 border-none rounded-md text-[var(--primary)] text-xs font-semibold px-2 py-1 cursor-pointer outline-none"
                >
                  <option value="all">TODAS</option>
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>
              <div className="text-xs text-slate-500">
                Exibindo {visibleItems.length} de {sortedDictionary.totalCount} itens
              </div>
            </div>
          }
        />

        <div className="items-list gap-4">
          {loading ? (
            <div className="text-center p-12">
              <Skeleton width="100%" height="80px" className="mb-4" />
              <Skeleton width="100%" height="80px" />
            </div>
          ) : visibleItems.length === 0 ? (
            <div className="glass-card text-center p-12">
              <p className="text-slate-500">Nenhum item encontrado no dicionario.</p>
            </div>
          ) : (
            <>
              {visibleItems.map((item) => (
                <div key={item.key}>
                  {editingKey === item.key ? (
                    <div className="glass-card animated-item mb-0 p-4">
                      <div className="flex flex-col gap-3">
                        <div className="text-xs text-slate-500 font-bold">
                          CHAVE: {item.key}
                        </div>
                        <input
                          type="text"
                          className="search-input bg-[var(--bg-color)]"
                          value={editForm.normalized_name}
                          onChange={(e) =>
                            setEditForm({ ...editForm, normalized_name: e.target.value })
                          }
                          placeholder="Nome normalizado"
                        />
                        <select
                          className="search-input bg-[var(--bg-color)]"
                          value={editForm.category}
                          onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                        >
                          {CATEGORIES.map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                        </select>
                        <select
                          className="search-input bg-[var(--bg-color)]"
                          value={editForm.canonical_product_id}
                          onChange={(e) =>
                            setEditForm({ ...editForm, canonical_product_id: e.target.value })
                          }
                        >
                          <option value="">Nao vinculado a Produto Canonico</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({p.brand || "Sem marca"})
                            </option>
                          ))}
                        </select>
                        <div className="flex gap-2">
                          <button
                            className="btn btn-success flex-1"
                            onClick={() => handleSaveEdit(item.key)}
                          >
                            <Save size={18} /> Salvar
                          </button>
                          <button
                            className="btn flex-1"
                            onClick={() => setEditingKey(null)}
                          >
                            <X size={18} /> Cancelar
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <DictionaryRow
                      item={item}
                      onEdit={handleStartEdit}
                      onDelete={handleDeleteEntry}
                      products={products}
                    />
                  )}
                </div>
              ))}
              {hasMore && (
                <div className="flex justify-center mt-2">
                  <button className="btn" onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}>
                    Carregar mais
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <ConfirmDialog
        isOpen={Boolean(confirmDialog)}
        title={confirmDialog?.title || ""}
        message={confirmDialog?.message || ""}
        confirmText={confirmDialog?.confirmText}
        cancelText={confirmDialog?.cancelText}
        danger={confirmDialog?.danger}
        busy={confirmBusy}
        onCancel={closeConfirm}
        onConfirm={runConfirm}
      />
    </>
  );
}

export default DictionaryTab;
