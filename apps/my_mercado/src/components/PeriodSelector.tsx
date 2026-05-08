import type { CSSProperties } from "react";
import type { HistoryFilters, SearchFilters } from "../types/ui";

type PeriodValue = "all" | "this-month" | "last-3-months" | "custom";

type PeriodSelectorProps<T extends HistoryFilters | SearchFilters> = {
  filters: T;
  onChange: (filters: T) => void;
  containerStyle?: CSSProperties;
  selectStyle?: CSSProperties;
  label?: string;
};

const PERIOD_OPTIONS = [
  { value: "all", label: "Todo período" },
  { value: "this-month", label: "Este mês" },
  { value: "last-3-months", label: "Últimos 3 meses" },
  { value: "custom", label: "Personalizado" },
];

/**
 * PeriodSelector - Seletor de período reutilizável
 *
 * Componente visual para seleção de período (all, this-month, last-3-months, custom)
 * Funciona com HistoryFilters ou SearchFilters.
 * Não gerencia estado interno - estado controlado via props.
 *
 * @example
 * // Com HistoryFilters
 * <PeriodSelector
 *   filters={historyFilters}
 *   onChange={setHistoryFilters}
 *   label="PERÍODO:"
 * />
 *
 * @example
 * // Com SearchFilters
 * <PeriodSelector
 *   filters={searchFilters}
 *   onChange={setSearchFilters}
 * />
 */
export function PeriodSelector<T extends HistoryFilters | SearchFilters>({
  filters,
  onChange,
  containerStyle = {},
  selectStyle = {},
  label = "PERÍODO:",
}: PeriodSelectorProps<T>) {

  return (
    <div
      className="flex items-center gap-2"
      style={containerStyle}
    >
      <span className="text-xs text-slate-500 font-medium">
        {label}
      </span>
      <select
        value={filters.period}
        onChange={(e) =>
          onChange({
            ...filters,
            period: e.target.value as PeriodValue,
          } as T)
        }
        className="bg-blue-500/10 border-none rounded-md text-[var(--primary)] text-xs font-semibold px-2 py-1 cursor-pointer outline-none"
        style={selectStyle}
      >
        {PERIOD_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

type PeriodDatePickersProps<T extends HistoryFilters | SearchFilters> = {
  filters: T;
  onChange: (filters: T) => void;
  containerStyle?: CSSProperties;
};

/**
 * PeriodDatePickers - Date pickers para período personalizado
 *
 * Renderiza inputs de data para início e fim quando o período é "custom".
 * Funciona com HistoryFilters ou SearchFilters.
 * Deve ser renderizado condicionalmente pelo componente pai.
 *
 * @example
 * // Com HistoryFilters
 * {historyFilters.period === "custom" && (
 *   <PeriodDatePickers
 *     filters={historyFilters}
 *     onChange={setHistoryFilters}
 *   />
 * )}
 */
export function PeriodDatePickers<T extends HistoryFilters | SearchFilters>({
  filters,
  onChange,
  containerStyle = {},
}: PeriodDatePickersProps<T>) {
  if (filters.period !== "custom") return null;

  const handleChange = (field: "startDate" | "endDate") => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    onChange({
      ...filters,
      [field]: e.target.value,
    } as T);
  };

  return (
    <div className="glass-card grid grid-cols-2 gap-3 mb-4 p-4" style={containerStyle}>
      <div>
        <label className="block text-[0.7rem] text-slate-500 mb-2 font-semibold uppercase">Início</label>
        <input
          type="date"
          className="search-input bg-white/5 text-[0.85rem] h-10"
          value={filters.startDate || ""}
          onChange={handleChange("startDate")}
        />
      </div>
      <div>
        <label className="block text-[0.7rem] text-slate-500 mb-2 font-semibold uppercase">Fim</label>
        <input
          type="date"
          className="search-input bg-white/5 text-[0.85rem] h-10"
          value={filters.endDate || ""}
          onChange={handleChange("endDate")}
        />
      </div>
    </div>
  );
}
