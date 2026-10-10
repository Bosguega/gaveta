import { toStoreSlug } from './stringUtils';
import { normalizeManualDate } from './date';
import type { Receipt, ReceiptItem } from '../types/domain';

const USER_SCOPE_SEPARATOR = '__u_';

function normalizeReceiptId(rawId: string | number | null | undefined): string {
  const value = `${rawId ?? ''}`.trim();
  return value || Date.now().toString();
}

export function toUserScopedReceiptId(
  rawId: string | number | null | undefined,
  userId: string | null | undefined,
): string {
  const baseId = normalizeReceiptId(rawId);
  if (!userId) return baseId;

  const suffix = `${USER_SCOPE_SEPARATOR}${userId}`;
  if (baseId.endsWith(suffix)) return baseId;
  return `${baseId}${suffix}`;
}

export function getReceiptIdCandidates(
  rawId: string | number | null | undefined,
  userId: string | null | undefined,
): string[] {
  const baseId = normalizeReceiptId(rawId);
  const scopedId = toUserScopedReceiptId(baseId, userId);
  return [...new Set([scopedId, baseId])];
}

/**
 * Gera um ID único para receipt manual
 */
export function generateManualReceiptId(establishment: string, dateStr: string): string {
  const randomSuffix = (globalThis.crypto?.randomUUID?.() ||
    `${Date.now()}_${Math.random().toString(16).slice(2)}`).replace(/-/g, '').slice(0, 12);

  return `manual_${normalizeManualDate(dateStr)}_${toStoreSlug(establishment)}_${randomSuffix}`;
}

/**
 * Hash SHA-256 hexadecimal (16 chars) de uma string.
 * Usa Web Crypto quando disponível (browser e Node modernos).
 */
async function sha256Hex16(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);

  const subtle = globalThis.crypto?.subtle;
  if (subtle) {
    const hashBuffer = await subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .slice(0, 16);
  }

  // Fallback determinístico simples (FNV-1a 64-bit-ish) para ambientes sem
  // Web Crypto. Mantém a propriedade de estabilidade/diferença exigida nos testes.
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 + c + i, 0x85ebca6b) >>> 0;
  }
  return (h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0')).slice(0, 16);
}

/**
 * Gera um ID determinístico para uma nota extraída pela galeria, reutilizando a
 * mesma receita de fingerprint do parser de NFC-e (establishment + date +
 * name:total de cada item). Assim, re-extrair a mesma imagem produz o mesmo ID
 * e a detecção de duplicidade funciona como nos demais fluxos.
 */
export async function generateGalleryReceiptId(
  establishment: string,
  date: string,
  items: Array<Pick<ReceiptItem, 'name' | 'total'>>,
): Promise<string> {
  const fingerprint = [
    establishment,
    date,
    ...items.map((i) => `${i.name}:${i.total ?? ''}`),
  ].join('|');

  const hash = await sha256Hex16(fingerprint);
  return `img-${hash}`;
}

// ==============================
// Correspondência por conteúdo (cruzamento entre fontes)
// ==============================

export const TOTAL_TOLERANCE = 0.02;
export const DATE_WINDOW_MS = 5 * 60 * 1000; // 5 minutos

/**
 * Tolerância em ms usada quando a data não tem horário (00:00:00) — evita
 * falsos negativos por falta de hora na leitura da IA.
 */
const NO_TIME_DATE_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface ContentMatchOptions {
  /** Tolerância absoluta no total da nota (padrão: R$ 0,02). */
  totalTolerance?: number;
  /** Janela de tempo considerada "sinal forte" na data (padrão: 5 min). */
  dateWindowMs?: number;
}

function normalizeMatchKey(value: string | null | undefined): string {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasTimeComponent(dateStr: string): boolean {
  return /\d{2}:\d{2}/.test(dateStr || '');
}

/** Converte uma data BR (DD/MM/AAAA HH:mm:ss) para epoch ms. */
function parseBrDateToMs(dateStr: string): number | null {
  const match = (dateStr || '').match(
    /^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?/,
  );
  if (!match) return null;
  const [, dd, mm, yyyy, hh, min, ss] = match;
  const d = new Date(
    Number(yyyy),
    Number(mm) - 1,
    Number(dd),
    Number(hh || '0'),
    Number(min || '0'),
    Number(ss || '0'),
  );
  return d.getTime();
}

/** Total da nota espelhando a semântica de calculateItemTotal. */
function receiptTotal(receipt: Receipt): number {
  return (receipt.items || []).reduce((sum, item) => {
    const qty = item.quantity ?? 1;
    const edited =
      item.paid_price !== undefined &&
      item.paid_price !== null &&
      item.price !== undefined &&
      item.price !== null &&
      item.paid_price !== item.price;
    if (edited) return sum + (item.paid_price as number) * qty;
    if (item.total !== undefined && item.total !== null) return sum + item.total;
    if (item.paid_price !== undefined && item.paid_price !== null) {
      return sum + item.paid_price * qty;
    }
    return sum + (item.price || 0) * qty;
  }, 0);
}

/**
 * Verifica se duas notas são "equivalentes" por conteúdo (cruzamento entre
 * fontes, ex.: QR ↔ galeria). Usa estabelecimento normalizado + data + total
 * como critérios principais, com quantidade e nomes de itens como evidências
 * adicionais. NÃO exige igualdade de quantidade de itens.
 *
 * Retorna:
 * - "exact": estabelecimento + data (janela forte) + total batem.
 * - "probable": estabelecimento + total batem, apoiados por evidências
 *   (quantidade de itens e/ou nomes), mesmo sem data forte.
 * - null: sem correspondência confiável.
 */
export function matchReceiptsByContent(
  candidate: Receipt,
  existing: Receipt,
  options: ContentMatchOptions = {},
): 'exact' | 'probable' | null {
  const totalTolerance = options.totalTolerance ?? TOTAL_TOLERANCE;
  const dateWindowMs = options.dateWindowMs ?? DATE_WINDOW_MS;

  const candidateKey = normalizeMatchKey(candidate.establishment);
  const existingKey = normalizeMatchKey(existing.establishment);
  if (!candidateKey || candidateKey !== existingKey) return null;

  const candidateTotal = receiptTotal(candidate);
  const existingTotal = receiptTotal(existing);
  const totalMatches = Math.abs(candidateTotal - existingTotal) <= totalTolerance;

  const candidateMs = parseBrDateToMs(candidate.date);
  const existingMs = parseBrDateToMs(existing.date);
  let dateStrong = false;
  if (candidateMs !== null && existingMs !== null) {
    const diff = Math.abs(candidateMs - existingMs);
    const window =
      hasTimeComponent(candidate.date) && hasTimeComponent(existing.date)
        ? dateWindowMs
        : NO_TIME_DATE_WINDOW_MS;
    dateStrong = diff <= window;
  }

  // Evidências adicionais: quantidade de itens e nomes normalizados.
  const candidateNames = new Set(
    (candidate.items || []).map((i) => normalizeMatchKey(i.normalized_name || i.name)).filter(Boolean),
  );
  const existingNames = new Set(
    (existing.items || []).map((i) => normalizeMatchKey(i.normalized_name || i.name)).filter(Boolean),
  );
  const sharedNames = [...candidateNames].filter((n) => existingNames.has(n)).length;
  const nameEvidence = sharedNames > 0;
  const sameItemCount = (candidate.items || []).length === (existing.items || []).length;

  if (totalMatches && dateStrong) return 'exact';

  // Total igual nunca é prova única — exigimos evidência adicional.
  if (totalMatches && (nameEvidence || sameItemCount)) return 'probable';

  return null;
}

/**
 * Encontra a melhor correspondência por conteúdo entre o candidato e a lista de
 * receipts existentes. Ignora o próprio candidato (por id). Prioriza "exact"
 * sobre "probable".
 */
export function findContentMatch(
  candidate: Receipt,
  existingReceipts: Receipt[],
  options: ContentMatchOptions = {},
): { receipt: Receipt; level: 'exact' | 'probable' } | null {
  let probable: { receipt: Receipt; level: 'probable' } | null = null;

  for (const existing of existingReceipts) {
    if (!existing) continue;
    if (existing.id && candidate.id && existing.id === candidate.id) continue;

    const level = matchReceiptsByContent(candidate, existing, options);
    if (level === 'exact') return { receipt: existing, level };
    if (level === 'probable' && !probable) probable = { receipt: existing, level };
  }

  return probable;
}
