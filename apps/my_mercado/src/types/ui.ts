/**
 * Tipos de UI e estado da aplicação
 *
 * @fileoverview Este arquivo contém tipos relacionados à interface do usuário,
 * filtros e configurações de UI
 */

import type { SessionUser } from "./domain";
import type { ReceiptItem } from "./domain";

// Re-export de tipos consolidados
export type {
  // History types
  FilteredReceipts,
  ConfirmDialogState,
  UseConfirmDialogReturn,
  HeaderSectionProps,
  SummaryCardProps,
  EmptyStateProps,
  ReceiptListProps,
  SortByOption,
  SortOption,
  SORT_OPTIONS,
  PeriodOption,
  PeriodSelectOption,
  PERIOD_OPTIONS,
} from "./history";

export type {
  // Scanner types
  ScannerScreen,
  SaveReceiptResponse,
  ManualReceiptData,
  ManualReceiptItemInput,
  ScannerControls,
  ManualReceiptFormProps,
  InitialScannerScreenProps,
  ScannerViewProps,
  ReceiptResultProps,
  DuplicateModalProps,
  LoadingScreenProps,
  ScanningScreenProps,
  ScannerStyles,
} from "./scanner";

// =========================
// APP NAVIGATION
// =========================

/**
 * Abas principais da aplicação
 */
export type AppTab = "scan" | "shopping" | "history" | "search" | "settings";

/**
 * Direção de ordenação
 */
export type SortDirection = "asc" | "desc";

/**
 * Critérios de ordenação para busca
 */
export type SearchSortBy = "recent" | "price";

// =========================
// SHOPPING LIST
// =========================

/**
 * Item de lista de compras na UI
 */
export interface ShoppingListItem {
  id: string;
  name: string;
  normalized_key: string;
  quantity?: string;
  note?: string;
  checked: boolean;
  created_at: string;
  checked_at?: string;
  checked_by_user_id?: string;
}

/**
 * Metadados de uma lista de compras
 */
export interface ShoppingListMeta {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

/**
 * Snapshot para sincronização de listas com cloud
 */
export interface ShoppingListsCloudSnapshot {
  version: 1;
  updated_at: string;
  lists: ShoppingListMeta[];
  active_list_id: string;
  items_by_list: Record<string, ShoppingListItem[]>;
}

// =========================
// FILTERS
// =========================

/**
 * Filtros para histórico de compras
 */
export interface HistoryFilters {
  search: string;
  period: string;
  sortBy: string;
  sortDirection: string;
}

/**
 * Configuração do diálogo de confirmação
 */
export interface ConfirmDialogConfig {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
}