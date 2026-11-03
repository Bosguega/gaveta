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
// FunÃ§Ãµes utilitÃ¡rias adicionais (migradas de dateUtils.ts)
// ==============================

/**
 * Normaliza data no formato DD/MM/YYYY para YYYYMMDD (sem separadores)
 * Usado para geraÃ§Ã£o de IDs de receipts manuais
 */
export function normalizeManualDate(value: string): string {
  const match = (value || "").toString().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return "data";
  const [, dd, mm, yyyy] = match;
  return `${yyyy}${mm}${dd}`;
}

/**
 * Valida se string Ã© uma data no formato DD/MM/YYYY
 */
export function isValidBRDate(value: string): boolean {
  const regex = /^\d{2}\/\d{2}\/\d{4}$/;
  if (!regex.test(value)) return false;

  const [dd, mm, yyyy] = value.split("/").map(Number);
  const date = new Date(yyyy, mm - 1, dd);
  return date.getFullYear() === yyyy && date.getMonth() === mm - 1 && date.getDate() === dd;
}

/**
 * ObtÃ©m data atual formatada como DD/MM/YYYY
 */
export function getCurrentDateBR(): string {
  return new Date().toLocaleDateString("pt-BR");
}

/**
 * Extrai ano e mÃªs de uma data YYYY-MM-DD
 */
export function extractYearMonth(isoDate: string): { year: number; month: number } | null {
  const match = isoDate.match(/^(\d{4})-(\d{2})/);
  if (!match) return null;
  return {
    year: parseInt(match[1], 10),
    month: parseInt(match[2], 10),
  };
}

// ==============================
// Utilitários de Data para Formulários Manuais
// ==============================

const BR_DATE_RE = /^(\d{2})\/(\d{2})\/(\d{4})/;
const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})/;
const TIME_RE = /(\d{2}):(\d{2})(?::(\d{2}))?/;

function isValidCalendarDate(yyyy: string, mm: string, dd: string): boolean {
  const y = Number(yyyy);
  const m = Number(mm);
  const d = Number(dd);
  if (!y || m < 1 || m > 12 || d < 1 || d > 31) return false;
  const date = new Date(y, m - 1, d);
  return (
    date.getFullYear() === y &&
    date.getMonth() === m - 1 &&
    date.getDate() === d
  );
}

/**
 * Converte data BR para a parte de data ISO do input[type=date].
 * Nunca inventa uma data: retorna "" quando a entrada está vazia/inválida,
 * evitando o "snap-back" para hoje que apagava a edição do usuário.
 */
export function brDateToIsoDatePart(br: string): string {
  if (!br) return "";
  const match = br.match(BR_DATE_RE);
  if (!match) return "";
  const [, dd, mm, yyyy] = match;
  if (!isValidCalendarDate(yyyy, mm, dd)) return "";
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Converte data ISO do input para BR, preservando a hora já existente.
 * Retorna "" se o ISO estiver vazio/inválido (chamador deve ignorar).
 */
export function isoDateToBrPreservingTime(iso: string, previousBr: string): string {
  if (!iso) return "";
  const match = iso.match(ISO_DATE_RE);
  if (!match) return "";
  const [, yyyy, mm, dd] = match;
  if (!isValidCalendarDate(yyyy, mm, dd)) return "";
  const timeMatch = previousBr?.match(TIME_RE);
  const time = timeMatch
    ? `${timeMatch[1]}:${timeMatch[2]}:${timeMatch[3] ?? "00"}`
    : "00:00:00";
  return `${dd}/${mm}/${yyyy} ${time}`;
}

/** Data/hora local atual no formato do store: DD/MM/AAAA HH:mm:ss. */
export function buildDefaultManualDate(now = new Date()): string {
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yyyy = String(now.getFullYear());
  const hh = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy} ${hh}:${min}:${ss}`;
}
