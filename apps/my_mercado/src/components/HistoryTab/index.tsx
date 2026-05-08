import { useMemo, type ChangeEvent } from "react";
import { notify } from "../../utils/notifications";
import { logger } from "../../utils/logger";
import { parseBRL } from "../../utils/currency";
import { calculateTotalSpent } from "../../utils/analytics";
import { backupToJSON, exportToCSV } from "../../utils/backupRegistry";
import { useDeleteReceipt, useRestoreReceipts } from "../../hooks/queries/useReceiptsQuery";
import { useHistoryReceipts } from "../../hooks/queries/useHistoryReceipts";
import { useUiStore } from "../../stores/useUiStore";
import { PeriodSelector, PeriodDatePickers } from "../PeriodSelector";
import ConfirmDialog from "../ConfirmDialog";
import UniversalSearchBar from "../UniversalSearchBar";
import { HeaderSection } from "./HeaderSection";
import { SummaryCard } from "./SummaryCard";
import { EmptyState } from "./EmptyState";
import { ReceiptList } from "./ReceiptList";
import { useConfirmDialog } from "../../hooks/useConfirmDialog";
import type { Receipt } from "../../types/domain";
import type { HistoryFilters } from "../../types/ui";
import { parseBackupJson } from "../../utils/validation/backupSchema";

// =========================
// CONSTANTES
// =========================

const SORT_OPTIONS = [
  { value: "date", label: "Data" },
  { value: "value", label: "Valor" },
  { value: "store", label: "Mercado" },
];

function HistoryTab() {
  // Hook unificado para filtros e dados de receipts
  const {
    receipts: savedReceipts,
    items: visibleItems,
    allItems: filteredItems,
    totalCount,
    hasMore,
    loadMore,
    isLoading: loading,
    filters: historyFilters,
    setFilters: setHistoryFilters,
    searchQuery: historyFilter,
    setSearchQuery: setHistoryFilter,
    refetch: refetchReceipts,
  } = useHistoryReceipts();

  const deleteReceiptMutation = useDeleteReceipt();
  const restoreReceiptsMutation = useRestoreReceipts();

  // Estados do diálogo de confirmação
  const { dialog, isOpen, busy, open, close, run } = useConfirmDialog();

  // Store de UI (apenas expandedReceipts)
  const expandedReceipts = useUiStore((state) => state.expandedReceipts);
  const setExpandedReceipts = useUiStore((state) => state.setExpandedReceipts);

  // Calcular total gasto
  const totalSpent = useMemo(
    () => calculateTotalSpent(filteredItems, parseBRL),
    [filteredItems]
  );

  // Handlers de backup
  const handleBackupJSON = () => backupToJSON(savedReceipts);
  const handleExportCSV = () => exportToCSV(filteredItems);

  const handleRestoreJSON = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!file.name.endsWith(".json")) {
      notify.error("Arquivo inválido! Selecione um arquivo .json");
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const resultText = e.target?.result;
        if (typeof resultText !== "string") {
          throw new Error("Conteúdo de backup inválido");
        }

        const parsedBackup = parseBackupJson(resultText);
        if (!parsedBackup.ok) {
          notify.error(parsedBackup.error);
          return;
        }

        const restoredReceipts = parsedBackup.data.receipts as Receipt[];

        open({
          title: "Restaurar backup?",
          message: `Isso vai substituir suas ${savedReceipts.length} notas atuais por ${restoredReceipts.length} notas do backup.`,
          confirmText: "Restaurar",
          danger: true,
          onCancel: () => {
            event.target.value = "";
          },
          onConfirm: async () => {
            try {
              await restoreReceiptsMutation.mutateAsync(restoredReceipts);
              event.target.value = "";
            } catch (syncErr) {
              logger.warn(
                "HistoryTab",
                "Não foi possível sincronizar backup com o Supabase",
                syncErr
              );
            }
          },
        });
      } catch (error) {
        logger.error("HistoryTab", "Erro ao ler backup", error);
        notify.error("Erro ao ler arquivo de backup");
      }
    };
    reader.onerror = () => {
      notify.error("Erro ao ler arquivo");
    };

    reader.readAsText(file);
  };

  const handleDeleteReceipt = (id: string) => {
    open({
      title: "Remover nota?",
      message: "Essa ação remove a nota do histórico e não pode ser desfeita.",
      confirmText: "Remover",
      danger: true,
      onConfirm: async () => {
        await deleteReceiptMutation.mutateAsync(id);
      },
    });
  };

  const handleToggleExpand = (id: string) => {
    setExpandedReceipts((prev) =>
      prev.includes(id) ? prev.filter((x: string) => x !== id) : [...prev, id]
    );
  };

  const isEmpty = savedReceipts.length === 0;
  const hasNoResults = filteredItems.length === 0 && !isEmpty && !loading;

  return (
    <>
      <HeaderSection
        totalCount={savedReceipts.length}
        filteredCount={totalCount}
        isLoading={loading}
        onRefresh={refetchReceipts}
        onBackup={handleBackupJSON}
        onRestore={handleRestoreJSON}
        onExportCSV={handleExportCSV}
      />

      {isEmpty && !loading ? (
        <EmptyState />
      ) : (
        <>
          <SummaryCard totalSpent={totalSpent} filteredCount={totalCount} />

          <UniversalSearchBar
            placeholder="Buscar por mercado..."
            value={historyFilter}
            onChange={setHistoryFilter}
            sortValue={historyFilters.sortBy}
            onSortChange={(val) =>
              setHistoryFilters({
                ...historyFilters,
                sortBy: val as HistoryFilters["sortBy"],
              })
            }
            sortOrder={historyFilters.sortOrder}
            onSortOrderChange={(val) =>
              setHistoryFilters({ ...historyFilters, sortOrder: val })
            }
            sortOptions={SORT_OPTIONS}
            extraActions={
              <PeriodSelector
                filters={historyFilters}
                onChange={setHistoryFilters}
                label="PERÍODO:"
              />
            }
          />

          {/* Date Pickers para Período Personalizado */}
          <PeriodDatePickers
            filters={historyFilters}
            onChange={setHistoryFilters}
          />

          <ReceiptList
            receipts={visibleItems}
            expandedReceipts={expandedReceipts}
            isLoading={loading && savedReceipts.length === 0}
            onToggleExpand={handleToggleExpand}
            onDelete={handleDeleteReceipt}
            isEmpty={isEmpty}
            hasNoResults={hasNoResults}
          />
          {hasMore && (
            <div className="flex justify-center mt-4">
              <button className="btn" onClick={loadMore}>
                Carregar mais
              </button>
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        isOpen={isOpen}
        title={dialog?.title || ""}
        message={dialog?.message || ""}
        confirmText={dialog?.confirmText}
        cancelText={dialog?.cancelText}
        danger={dialog?.danger}
        busy={busy}
        onCancel={close}
        onConfirm={run}
      />
    </>
  );
}

export default HistoryTab;
