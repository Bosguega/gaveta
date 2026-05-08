import type { Receipt } from "../../types/domain";

// =========================
// FILTER RESULTS
// =========================

export interface FilteredReceipts {
  items: Receipt[];
  totalCount: number;
}

// =========================
// CONFIRM DIALOG
// =========================

export interface ConfirmDialogState {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  onConfirm: () => Promise<void>;
  onCancel?: () => void;
}

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

export interface HeaderSectionProps {
  totalCount: number;
  filteredCount: number;
  isLoading: boolean;
  onRefresh: () => void;
  onBackup: () => void;
  onRestore: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onExportCSV: () => void;
}

export interface SummaryCardProps {
  totalSpent: number;
  filteredCount: number;
}

export interface EmptyStateProps {
  onRestore: () => void;
}

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

export type SortByOption = "date" | "value" | "store";

export interface SortOption {
  value: SortByOption;
  label: string;
}

export const SORT_OPTIONS: SortOption[] = [
  { value: "date", label: "Data" },
  { value: "value", label: "Valor" },
  { value: "store", label: "Mercado" },
];

// =========================
// PERIOD OPTIONS
// =========================

export type PeriodOption = "all" | "this-month" | "last-3-months" | "custom";

export interface PeriodSelectOption {
  value: PeriodOption;
  label: string;
}

export const PERIOD_OPTIONS: PeriodSelectOption[] = [
  { value: "all", label: "Todo período" },
  { value: "this-month", label: "Este mês" },
  { value: "last-3-months", label: "Últimos 3 meses" },
  { value: "custom", label: "Personalizado" },
];
