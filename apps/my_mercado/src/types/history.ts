/**
 * Tipos para funcionalidades de History Tab
 *
 * @fileoverview Este arquivo contém tipos relacionados ao histórico de compras
 */

import type { Receipt } from "./domain";

// =========================
// FILTER RESULTS
// =========================

/**
 * Resultado filtrado de receipts após aplicação de filtros
 */
export interface FilteredReceipts {
  items: Receipt[];
  totalCount: number;
}

// =========================
// CONFIRM DIALOG
// =========================

/**
 * Estado do diálogo de confirmação
 */
export interface ConfirmDialogState {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  onConfirm: () => Promise<void>;
  onCancel?: () => void;
}

/**
 * Retorno do hook useConfirmDialog
 */
export interface UseConfirmDialogReturn {
  dialog: ConfirmDialogState | null;
  isOpen: boolean;
  busy: boolean;
  open: (dialog: ConfirmDialogState) => void;
  close: () => void;
  run: () => Promise<void>;
}

// =========================
// COMPONENT PROPS
// =========================

/**
 * Props para o componente HeaderSection
 */
export interface HeaderSectionProps {
  totalCount: number;
  filteredCount: number;
  isLoading: boolean;
  onRefresh: () => void;
  onBackup: () => void;
  onRestore: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onExportCSV: () => void;
}

/**
 * Props para o componente SummaryCard
 */
export interface SummaryCardProps {
  totalSpent: number;
  filteredCount: number;
}

/**
 * Props para o componente EmptyState
 */
export interface EmptyStateProps {
  onRestore: () => void;
}

/**
 * Props para o componente ReceiptList
 */
export interface ReceiptListProps {
  receipts: Receipt[];
  expandedReceipts: string[];
  isLoading: boolean;
  onToggleExpand: (id: string) => void;
  onDelete: (id: string) => void;
  isEmpty: boolean;
  hasNoResults: boolean;
}

// =========================
// SORT OPTIONS
// =========================

/**
 * Opções de ordenação para histórico
 */
export type SortByOption = "date" | "value" | "store";

/**
 * Opção de ordenação com valor e label
 */
export interface SortOption {
  value: SortByOption;
  label: string;
}

/**
 * Lista de opções de ordenação disponíveis
 */
export const SORT_OPTIONS: SortOption[] = [
  { value: "date", label: "Data" },
  { value: "value", label: "Valor" },
  { value: "store", label: "Mercado" },
];

// =========================
// PERIOD OPTIONS
// =========================

/**
 * Opções de período para filtros
 */
export type PeriodOption = "all" | "this-month" | "last-3-months" | "custom";

/**
 * Opção de período com valor e label
 */
export interface PeriodSelectOption {
  value: PeriodOption;
  label: string;
}

/**
 * Lista de opções de período disponíveis
 */
export const PERIOD_OPTIONS: PeriodSelectOption[] = [
  { value: "all", label: "Todo período" },
  { value: "this-month", label: "Este mês" },
  { value: "last-3-months", label: "Últimos 3 meses" },
  { value: "custom", label: "Personalizado" },
];
