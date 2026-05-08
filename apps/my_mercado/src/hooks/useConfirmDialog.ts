import { useState, useCallback } from "react";
import type { ConfirmDialogConfig } from "../types/ui";

export interface UseConfirmDialogReturn {
  dialog: ConfirmDialogConfig | null;
  isOpen: boolean;
  busy: boolean;
  open: (config: ConfirmDialogConfig) => void;
  close: () => void;
  run: () => Promise<void>;
}

/**
 * Hook reutilizável para gerenciar o estado de diálogos de confirmação.
 *
 * @example
 * ```tsx
 * const { dialog, isOpen, busy, open, close, run } = useConfirmDialog();
 *
 * open({
 *   title: "Remover?",
 *   message: "Essa ação não pode ser desfeita.",
 *   confirmText: "Remover",
 *   danger: true,
 *   onConfirm: async () => { await deleteItem(); },
 * });
 *
 * <ConfirmDialog
 *   isOpen={isOpen}
 *   title={dialog?.title || ""}
 *   message={dialog?.message || ""}
 *   confirmText={dialog?.confirmText}
 *   cancelText={dialog?.cancelText}
 *   danger={dialog?.danger}
 *   busy={busy}
 *   onCancel={close}
 *   onConfirm={run}
 * />
 * ```
 */
export function useConfirmDialog(): UseConfirmDialogReturn {
  const [dialog, setDialog] = useState<ConfirmDialogConfig | null>(null);
  const [busy, setBusy] = useState(false);

  const open = useCallback((config: ConfirmDialogConfig) => {
    setDialog(config);
  }, []);

  const close = useCallback(() => {
    dialog?.onCancel?.();
    setDialog(null);
    setBusy(false);
  }, [dialog]);

  const run = useCallback(async () => {
    if (!dialog) return;
    setBusy(true);
    try {
      await dialog.onConfirm();
      setDialog(null);
    } finally {
      setBusy(false);
    }
  }, [dialog]);

  return { dialog, isOpen: !!dialog, busy, open, close, run };
}
