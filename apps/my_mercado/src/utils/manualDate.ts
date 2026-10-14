/**
 * Conversão de datas para o formulário manual.
 *
 * O store guarda a data em formato BR (`DD/MM/AAAA`, com `HH:mm:ss` opcional)
 * enquanto o `input[type=date]` trabalha com `AAAA-MM-DD`.
 */

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
 * Converte data BR para a parte de data ISO do `input[type=date]`.
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

/** Data/hora local atual no formato do store: `DD/MM/AAAA HH:mm:ss`. */
export function buildDefaultManualDate(now = new Date()): string {
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yyyy = String(now.getFullYear());
  const hh = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy} ${hh}:${min}:${ss}`;
}
