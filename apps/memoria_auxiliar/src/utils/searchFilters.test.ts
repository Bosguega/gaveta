import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FILTERS,
  filterNotes,
  hasActiveFilters,
  noteMatchesFilters,
  noteMatchesPeriod,
  periodEnd,
  periodStart,
} from './searchFilters';
import type { SearchFilters } from './searchFilters';
import type { Note } from '../types';

const NOW = new Date(2025, 5, 15, 12, 0, 0); // 15/06/2025

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: 1,
    content: 'conteudo',
    tags: '',
    pinned: false,
    reminder_at: null,
    embedding: '[]',
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: null,
    ...overrides,
  } as Note;
}

function filters(overrides: Partial<SearchFilters> = {}): SearchFilters {
  return { ...DEFAULT_FILTERS, ...overrides };
}

describe('periodStart / periodEnd', () => {
  it('returns null for "all"', () => {
    expect(periodStart('all', NOW)).toBeNull();
    expect(periodEnd('all', NOW)).toBeNull();
  });

  it('goes back 7 and 30 days', () => {
    expect(periodStart('7d', NOW)).toEqual(new Date(2025, 5, 8, 12, 0, 0));
    expect(periodStart('30d', NOW)).toEqual(new Date(2025, 4, 16, 12, 0, 0));
    expect(periodEnd('7d', NOW)).toBeNull();
  });

  it('starts at the first day of the current month', () => {
    expect(periodStart('month', NOW)).toEqual(new Date(2025, 5, 1));
  });

  it('treats "ano passado" as a closed interval', () => {
    expect(periodStart('lastYear', NOW)).toEqual(new Date(2024, 0, 1));
    // O limite superior é o início do ano corrente: usar 31/12 23:59:59.999
    // deixaria passar registros com precisão de microssegundos.
    expect(periodEnd('lastYear', NOW)).toEqual(new Date(2025, 0, 1));
  });
});

describe('noteMatchesPeriod', () => {
  it('accepts every note when period is "all"', () => {
    expect(noteMatchesPeriod(makeNote({ created_at: '1999-01-01T00:00:00.000Z' }), 'all', NOW)).toBe(true);
  });

  it('keeps notes inside the last 7 days', () => {
    expect(noteMatchesPeriod(makeNote({ created_at: '2025-06-14T09:00:00.000Z' }), '7d', NOW)).toBe(true);
  });

  it('rejects notes older than the last 7 days', () => {
    expect(noteMatchesPeriod(makeNote({ created_at: '2025-06-01T09:00:00.000Z' }), '7d', NOW)).toBe(false);
  });

  it('keeps notes created earlier in the current month', () => {
    expect(noteMatchesPeriod(makeNote({ created_at: '2025-06-02T09:00:00.000Z' }), 'month', NOW)).toBe(true);
  });

  it('rejects notes from the previous month', () => {
    expect(noteMatchesPeriod(makeNote({ created_at: '2025-05-31T23:00:00.000Z' }), 'month', NOW)).toBe(false);
  });

  it('respects the bounds of "ano passado"', () => {
    expect(noteMatchesPeriod(makeNote({ created_at: '2024-06-15T12:00:00.000Z' }), 'lastYear', NOW)).toBe(true);
    expect(noteMatchesPeriod(makeNote({ created_at: '2023-12-31T23:59:59.000Z' }), 'lastYear', NOW)).toBe(false);
    expect(noteMatchesPeriod(makeNote({ created_at: '2025-06-15T12:00:00.000Z' }), 'lastYear', NOW)).toBe(false);
  });

  it('rejects notes with an unparseable date', () => {
    expect(noteMatchesPeriod(makeNote({ created_at: 'nao-e-data' }), 'month', NOW)).toBe(false);
  });
});

describe('hasActiveFilters', () => {
  it('is false for the defaults', () => {
    expect(hasActiveFilters(DEFAULT_FILTERS)).toBe(false);
  });

  it('detects each filter independently', () => {
    expect(hasActiveFilters(filters({ tag: 'trabalho' }))).toBe(true);
    expect(hasActiveFilters(filters({ period: '7d' }))).toBe(true);
    expect(hasActiveFilters(filters({ pinnedOnly: true }))).toBe(true);
    expect(hasActiveFilters(filters({ withReminder: true }))).toBe(true);
    expect(hasActiveFilters(filters({ embedding: 'with' }))).toBe(true);
  });
});

describe('noteMatchesFilters', () => {
  it('accepts a plain note when no filter is active', () => {
    expect(noteMatchesFilters(makeNote(), filters(), NOW)).toBe(true);
  });

  it('applies the tag filter', () => {
    const note = makeNote({ tags: 'Trabalho, urgente' });
    expect(noteMatchesFilters(note, filters({ tag: 'trabalho' }), NOW)).toBe(true);
    expect(noteMatchesFilters(note, filters({ tag: 'pessoal' }), NOW)).toBe(false);
  });

  it('applies the pinned filter', () => {
    expect(noteMatchesFilters(makeNote({ pinned: true }), filters({ pinnedOnly: true }), NOW)).toBe(true);
    expect(noteMatchesFilters(makeNote({ pinned: false }), filters({ pinnedOnly: true }), NOW)).toBe(false);
  });

  it('applies the reminder filter', () => {
    const withReminder = makeNote({ reminder_at: '2025-07-01T10:00:00.000Z' });
    expect(noteMatchesFilters(withReminder, filters({ withReminder: true }), NOW)).toBe(true);
    expect(noteMatchesFilters(makeNote(), filters({ withReminder: true }), NOW)).toBe(false);
  });

  it('applies the embedding filter', () => {
    const embedded = makeNote({ embedding: '[0.1,0.2,0.3]' });
    const without = makeNote({ embedding: '[]' });
    expect(noteMatchesFilters(embedded, filters({ embedding: 'with' }), NOW)).toBe(true);
    expect(noteMatchesFilters(without, filters({ embedding: 'with' }), NOW)).toBe(false);
    expect(noteMatchesFilters(without, filters({ embedding: 'without' }), NOW)).toBe(true);
    expect(noteMatchesFilters(embedded, filters({ embedding: 'without' }), NOW)).toBe(false);
  });

  it('combines filters with AND semantics', () => {
    const match = makeNote({
      tags: 'trabalho',
      pinned: true,
      reminder_at: '2025-06-20T10:00:00.000Z',
      embedding: '[0.1,0.2]',
      created_at: '2025-06-10T09:00:00.000Z',
    });
    const combined = filters({
      tag: 'trabalho',
      period: '7d',
      pinnedOnly: true,
      withReminder: true,
      embedding: 'with',
    });
    expect(noteMatchesFilters(match, combined, NOW)).toBe(true);
    // Breaking a single filter is enough to exclude the note.
    expect(noteMatchesFilters({ ...match, pinned: false }, combined, NOW)).toBe(false);
  });
});

describe('filterNotes', () => {
  it('returns the same list when no filter is active', () => {
    const notes = [makeNote({ id: 1 }), makeNote({ id: 2 })];
    expect(filterNotes(notes, DEFAULT_FILTERS, NOW)).toBe(notes);
  });

  it('applies every active filter before the ranking', () => {
    const notes = [
      makeNote({ id: 1, tags: 'trabalho', created_at: '2025-06-14T00:00:00.000Z' }),
      makeNote({ id: 2, tags: 'pessoal', created_at: '2025-06-14T00:00:00.000Z' }),
      makeNote({ id: 3, tags: 'trabalho', created_at: '2024-01-01T00:00:00.000Z' }),
    ];
    const active = filters({ tag: 'trabalho', period: '7d' });
    expect(filterNotes(notes, active, NOW).map((n) => n.id)).toEqual([1]);
  });

  it('returns the original list reference when no filter is active', () => {
    const notes = [makeNote({ id: 1 })];
    expect(filterNotes(notes, DEFAULT_FILTERS, NOW)).toBe(notes);
  });
});
