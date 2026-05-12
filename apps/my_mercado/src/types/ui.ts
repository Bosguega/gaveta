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
  period: "all" | "this-month" | "last-3-months" | "custom";
  sortBy: "date" | "value" | "store";
  sortOrder: SortDirection;
  startDate: string;
  endDate: string;
}

/**
 * Filtros para busca de preços
 */
export interface SearchFilters {
  period: "all" | "this-month" | "last-3-months" | "custom";
  startDate: string;
  endDate: string;
}

// =========================
// COMPONENT PROPS
// =========================

/**
 * Props para componente de Login
 */
export interface LoginProps {
  setSessionUser: (user: SessionUser | null) => void;
}

/**
 * Props para modal de API Key
 */
export interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentKey?: string;
  onSave: (key: string) => void | Promise<void>;
  persistKey?: boolean;
  onPersistChange?: (persist: boolean) => void | Promise<void>;
}

/**
 * Props para ConfirmDialog (versão antiga, usar ConfirmDialogConfig)
 * @deprecated Usar ConfirmDialogConfig
 */
export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

/**
 * Configuração para diálogo de confirmação
 */
export interface ConfirmDialogConfig {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
}

// =========================
// PURCHASE HISTORY
// =========================

/**
 * Item comprado com informações adicionais
 */
export interface PurchasedItem extends ReceiptItem {
  purchasedAt?: string;
  store?: string;
}
