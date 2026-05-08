import { useEffect, useId, useState } from "react";

type InputDialogProps = {
  isOpen: boolean;
  title: string;
  message?: string;
  placeholder?: string;
  initialValue?: string;
  confirmText?: string;
  cancelText?: string;
  busy?: boolean;
  onConfirm: (value: string) => void | Promise<void>;
  onCancel: () => void;
};

export default function InputDialog({
  isOpen,
  title,
  message,
  placeholder,
  initialValue = "",
  confirmText = "Salvar",
  cancelText = "Cancelar",
  busy = false,
  onConfirm,
  onCancel,
}: InputDialogProps) {
  const inputId = useId();
  const [value, setValue] = useState(initialValue);
  const isInvalid = !value.trim();

  useEffect(() => {
    if (isOpen) {
      setValue(initialValue);
    }
  }, [isOpen, initialValue]);

  if (!isOpen) return null;

  return (
    <div className="duplicate-modal-overlay z-[4600]">
      <div className="glass-card duplicate-modal-card shopping-input-dialog-card">
        <h3 className="text-white mb-3">{title}</h3>
        {message && (
          <p className="text-slate-400 leading-relaxed mb-[0.85rem]">{message}</p>
        )}
        <div className="mb-[0.95rem]">
          <label htmlFor={inputId} className="hidden">
            {title}
          </label>
          <input
            id={inputId}
            className="search-input"
            placeholder={placeholder}
            value={value}
            autoFocus
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !busy) {
                event.preventDefault();
                if (!isInvalid) void onConfirm(value);
              }
            }}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={onCancel}
            disabled={busy}
            className="btn bg-white/5 border border-[var(--card-border)]"
          >
            {cancelText}
          </button>
          <button
            className="btn btn-success"
            onClick={() => void onConfirm(value)}
            disabled={busy || isInvalid}
          >
            {busy ? "Salvando..." : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
