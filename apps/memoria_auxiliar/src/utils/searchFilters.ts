import type { Note } from '../types';
import { hasValidEmbedding } from '../services/similarityService';
import { noteMatchesTag } from './tagFilter';

/**
 * Períodos ACEITOS pela busca. Valores simples e estáveis: guardá-los no store
 * e no filtro evita reinterpretar texto livre do usuário.
 */
export type PeriodFilter = 'all' | '7d' | '30d' | 'month' | 'lastYear';

export type EmbeddingFilter = 'any' | 'with' | 'without';

export interface SearchFilters {
  tag: string | null;
  period: PeriodFilter;
  pinnedOnly: boolean;
  withReminder: boolean;
  embedding: EmbeddingFilter;
}

export const DEFAULT_FILTERS: SearchFilters = {
  tag: null,
  period: 'all',
  pinnedOnly: false,
  withReminder: false,
  embedding: 'any',
};

/**
 * Data inicial do período, ou null para "todo o histórico".
 * O cálculo é feito sobre `created_at`, o mesmo campo já usado na ordenação.
 */
export function periodStart(period: PeriodFilter, now: Date = new Date()): Date | null {
  const start = new Date(now.getTime());

  switch (period) {
    case '7d':
      start.setDate(start.getDate() - 7);
      return start;
    case '30d':
      start.setDate(start.getDate() - 30);
      return start;
    case 'month':
      return new Date(start.getFullYear(), start.getMonth(), 1);
    case 'lastYear': {
      const year = start.getFullYear() - 1;
      return new Date(year, 0, 1);
    }
    case 'all':
    default:
      return null;
  }
}

export function periodEnd(period: PeriodFilter, now: Date = new Date()): Date | null {
  if (period !== 'lastYear') return null;
  // "Ano passado" é um intervalo fechado: 1º de janeiro até 31 de dezembro.
  return new Date(now.getFullYear(), 0, 1);
}

export function noteMatchesPeriod(
  note: Note,
  period: PeriodFilter,
  now: Date = new Date(),
): boolean {
  const start = periodStart(period, now);
  const end = periodEnd(period, now);
  if (!start && !end) return true;

  // Notas sem data interpretável não podem satisfazer um filtro de período.
  const created = new Date(note.created_at);
  if (Number.isNaN(created.getTime())) return false;

  if (start && created < start) return false;
  if (end && created >= end) return false;
  return true;
}

export function noteMatchesFilters(
  note: Note,
  filters: SearchFilters,
  now: Date = new Date(),
): boolean {
  if (!noteMatchesTag(note, filters.tag)) return false;
  if (filters.pinnedOnly && !note.pinned) return false;
  if (filters.withReminder && !note.reminder_at) return false;
  if (filters.embedding === 'with' && !hasValidEmbedding(note)) return false;
  if (filters.embedding === 'without' && hasValidEmbedding(note)) return false;
  return noteMatchesPeriod(note, filters.period, now);
}

/**
 * Restringe as notas a todos os filtros ativos.
 *
 * Usado como candidatos ANTES da busca por similaridade, para que o limite de
 * resultados seja preenchido por notas que o usuário realmente verá.
 */
export function filterNotes(
  notes: Note[],
  filters: SearchFilters,
  now: Date = new Date(),
): Note[] {
  if (!hasActiveFilters(filters)) return notes;
  return notes.filter((note) => noteMatchesFilters(note, filters, now));
}

export function hasActiveFilters(filters: SearchFilters): boolean {
  return (
    filters.tag !== null ||
    filters.period !== 'all' ||
    filters.pinnedOnly ||
    filters.withReminder ||
    filters.embedding !== 'any'
  );
}
