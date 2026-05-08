import { format, isValid, parseISO, isDate } from "date-fns";
import { ptBR } from "date-fns/locale";

const BR_DATE_TIME_RE =
  /^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/;

const SQL_DATE_TIME_RE =
  /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/;

const ISO_WITH_TZ_RE = /(?:Z|[+-]\d{2}:?\d{2})$/;

function toDateFromParts(
  year: string,
  month: string,
  day: string,
  hour?: string,
  minute?: string,
  second?: string,
): Date {
  return new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour || "0"),
    Number(minute || "0"),
    Number(second || "0"),
    0,
  );
}

// Converte formatos conhecidos para Date.
export function parseToDate(dateVal: string | Date | null | undefined): Date | null {
  if (!dateVal) return null;
  if (isDate(dateVal)) {
    return isValid(dateVal as Date) ? (dateVal as Date) : null;
  }

  if (typeof dateVal !== "string") return null;

  const trimmed = dateVal.trim();
  if (!trimmed) return null;

  const brMatch = trimmed.match(BR_DATE_TIME_RE);
  if (brMatch) {
    const [, dd, mm, yyyy, hh, min, ss] = brMatch;
    return toDateFromParts(yyyy, mm, dd, hh, min, ss);
  }

  const sqlMatch = trimmed.match(SQL_DATE_TIME_RE);
  if (sqlMatch) {
    const [, yyyy, mm, dd, hh, min, ss] = sqlMatch;
    return toDateFromParts(yyyy, mm, dd, hh, min, ss);
  }

  // ISO com timezone explicito: manter conversao correta.
  if (trimmed.includes("T") && ISO_WITH_TZ_RE.test(trimmed)) {
    const parsed = parseISO(trimmed);
    if (isValid(parsed)) return parsed;
  }

  const parsedISO = parseISO(trimmed);
  if (isValid(parsedISO)) return parsedISO;

  const nativeDate = new Date(trimmed);
  return isValid(nativeDate) ? nativeDate : null;
}

// Formata para DD/MM/AAAA HH:mm:ss.
export function formatToBR(
  dateVal: string | Date | null | undefined,
  includeTime = true,
): string {
  const date = parseToDate(dateVal);
  if (!date) return "";

  const pattern = includeTime ? "dd/MM/yyyy HH:mm:ss" : "dd/MM/yyyy";
  return format(date, pattern, { locale: ptBR });
}

// Formato para coluna timestamp sem timezone (evita conversao para UTC).
export function formatToISO(dateVal: string | Date | null | undefined): string | null {
  const date = parseToDate(dateVal);
  return date && isValid(date) ? format(date, "yyyy-MM-dd HH:mm:ss") : null;
}

// Formato para input type="date".
export function formatToInputDate(dateVal: string | Date | null | undefined): string {
  const date = parseToDate(dateVal);
  if (!date || !isValid(date)) return "";
  return format(date, "yyyy-MM-dd");
}

// Formato relativo (hoje, ontem, etc.).
export function formatRelative(dateVal: string | Date | null | undefined): string {
  const date = parseToDate(dateVal);
  if (!date || !isValid(date)) return "";

  return new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" }).format(
    Math.ceil((date.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)),
    "day",
  );
}

// ==============================
// Funções utilitárias adicionais (migradas de dateUtils.ts)
// ==============================

/**
 * Normaliza data no formato DD/MM/YYYY para YYYYMMDD (sem separadores)
 * Usado para geração de IDs de receipts manuais
 */
export function normalizeManualDate(value: string): string {
  const match = (value || "").toString().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return "data";
  const [, dd, mm, yyyy] = match;
  return `${yyyy}${mm}${dd}`;
}

/**
 * Valida se string é uma data no formato DD/MM/YYYY
 */
export function isValidBRDate(value: string): boolean {
  const regex = /^\d{2}\/\d{2}\/\d{4}$/;
  if (!regex.test(value)) return false;

  const [dd, mm, yyyy] = value.split("/").map(Number);
  const date = new Date(yyyy, mm - 1, dd);
  return date.getFullYear() === yyyy && date.getMonth() === mm - 1 && date.getDate() === dd;
}

/**
 * Obtém data atual formatada como DD/MM/YYYY
 */
export function getCurrentDateBR(): string {
  return new Date().toLocaleDateString("pt-BR");
}

/**
 * Extrai ano e mês de uma data YYYY-MM-DD
 */
export function extractYearMonth(isoDate: string): { year: number; month: number } | null {
  const match = isoDate.match(/^(\d{4})-(\d{2})/);
  if (!match) return null;
  return {
    year: parseInt(match[1], 10),
    month: parseInt(match[2], 10),
  };
}
