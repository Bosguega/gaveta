import { Search, ArrowDownAZ } from 'lucide-react';
import { useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type { SortDirection } from '../types/ui';

const PLACEHOLDER_IDLE = "Pesquisar por nome ou categoria";
const PLACEHOLDER_FOCUSED = "Use espaço para separar termos e - para excluir";

type UniversalSearchBarProps = {
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  sortValue?: string;
  onSortChange?: (value: string) => void;
  sortOrder?: SortDirection | null;
  onSortOrderChange?: (value: SortDirection) => void;
  sortOptions?: Array<{ value: string; label: string }>;
  sortLabel?: string;
  extraActions?: ReactNode;
  containerClassName?: string;
  inputClassName?: string;
  containerStyle?: CSSProperties;
  inputStyle?: CSSProperties;
};

/**
 * UniversalSearchBar - Componente centralizado de busca e ordenação
 * Mantém a identidade visual "glassmorphism" e simplifica a manutenção entre abas.
 *
 * O placeholder do input muda dinamicamente conforme o foco:
 * - Sem foco: "Pesquisar por nome ou categoria"
 * - Com foco: "Use espaço para separar termos e - para excluir"
 */
const UniversalSearchBar = ({
  placeholder,
  value,
  onChange,
  sortValue,
  onSortChange,
  sortOrder = null, // "asc" | "desc" | null
  onSortOrderChange,
  sortOptions = [],
  sortLabel = "ORDENAR:",
  extraActions = null,
  containerClassName = "",
  inputClassName = "",
  containerStyle = {},
  inputStyle = {}
}: UniversalSearchBarProps) => {
  const [isFocused, setIsFocused] = useState(false);

  // Placeholder dinâmico: muda conforme o foco
  // Se o consumidor passar um placeholder customizado, respeita-o
  const idlePlaceholder = placeholder ?? PLACEHOLDER_IDLE;
  const activePlaceholder = isFocused ? PLACEHOLDER_FOCUSED : idlePlaceholder;

  return (
    <div
      className={`glass-card p-5 flex flex-col gap-4 mb-4 ${containerClassName}`}
      style={containerStyle}
    >
      {/* Campo de Busca */}
      <div className="relative w-full">
        <Search
          size={18}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
        />
        <input
          type="text"
          placeholder={activePlaceholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className={`search-input-field h-12 rounded-xl border-none bg-white/5 text-[0.95rem] w-full pl-12 pr-4 text-white outline-none ${inputClassName}`}
          style={inputStyle}
        />
      </div>

      {/* Seletor de ordenação / Filtros / Ações Extras */}
      <div className="flex items-center justify-between px-1 flex-wrap gap-4">
        <div className="flex items-center gap-2">
          {sortLabel && (
            <span className="text-[0.8rem] text-slate-500 font-medium">
              {sortLabel}
            </span>
          )}
          {sortOptions.length > 0 && (
            <select
              value={sortValue}
              onChange={(e) => onSortChange?.(e.target.value)}
              className="bg-blue-500/10 border-none rounded-md text-primary text-[0.8rem] font-semibold py-1 px-2 cursor-pointer outline-none"
            >
              {sortOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          )}

          {sortOrder && onSortOrderChange && (
            <button
              onClick={() => onSortOrderChange(sortOrder === "asc" ? "desc" : "asc")}
              className="btn bg-blue-500/10 border-none rounded-lg w-9 h-9 flex items-center justify-center text-primary transition-all duration-200 ease-out"
              title={sortOrder === "asc" ? "Crescente" : "Decrescente"}
            >
              <div
                className={`flex transition-transform duration-500 ease-in-out ${sortOrder === "asc" ? "rotate-180" : "rotate-0"}`}
              >
                <ArrowDownAZ size={20} />
              </div>
            </button>
          )}
        </div>

        {/* Espaço para botões de ação (ex: Gráfico) */}
        {extraActions && (
          <div className="flex gap-2 items-center">
            {extraActions}
          </div>
        )}
      </div>
    </div>
  );
};

export default UniversalSearchBar;
