import { describe, expect, it } from 'vitest';
import {
  detectDuplicates,
  findDuplicateNotes,
  findRelatedNotes,
  findTextualDuplicates,
} from './relatedNotesService';
import type { Note } from '../types';

function makeNote(id: number, embedding: number[], content = `nota ${id}`): Note {
  return {
    id,
    content,
    tags: '',
    pinned: false,
    reminder_at: null,
    embedding: JSON.stringify(embedding),
    parsedEmbedding: embedding,
    created_at: '2024-01-01T00:00:00.000Z',
  } as Note;
}

describe('findRelatedNotes', () => {
  it('returns nothing when the reference note has no embedding', () => {
    const notes = [makeNote(1, [1, 0, 0])];
    const reference = makeNote(2, []);
    expect(findRelatedNotes(notes, reference)).toEqual([]);
  });

  it('never includes the reference note itself', () => {
    const reference = makeNote(1, [1, 0, 0]);
    const notes = [reference, makeNote(2, [1, 0, 0])];
    const related = findRelatedNotes(notes, reference);
    expect(related.map((r) => r.note.id)).toEqual([2]);
  });

  it('suggests close notes and drops unrelated ones', () => {
    const reference = makeNote(1, [1, 0, 0]);
    const notes = [
      reference,
      makeNote(2, [0.9, 0.1, 0]), // very close
      makeNote(3, [0, 1, 0]),       // orthogonal
    ];
    const related = findRelatedNotes(notes, reference);
    expect(related.map((r) => r.note.id)).toEqual([2]);
    expect(related[0].score).toBeGreaterThan(0.7);
  });
});

describe('findDuplicateNotes', () => {
  it('returns nothing without an embedding', () => {
    expect(findDuplicateNotes([makeNote(1, [1, 0, 0])], [])).toEqual([]);
  });

  it('only reports notes above the duplicate threshold', () => {
    const notes = [makeNote(1, [1, 0, 0]), makeNote(2, [0.99, 0.01, 0]), makeNote(3, [0.5, 0.5, 0])];
    // excludeId 1 removes the note holding the reference vector itself.
    const duplicates = findDuplicateNotes(notes, [1, 0, 0], { excludeId: 1 });
    expect(duplicates.map((d) => d.note.id)).toEqual([2]);
  });

  it('respects the limit', () => {
    const notes = [makeNote(1, [1, 0, 0]), makeNote(2, [1, 0, 0]), makeNote(3, [1, 0, 0])];
    expect(findDuplicateNotes(notes, [1, 0, 0], { excludeId: 1, limit: 2 })).toHaveLength(2);
  });

  it('excludes the note being edited', () => {
    const notes = [makeNote(1, [1, 0, 0]), makeNote(2, [1, 0, 0])];
    const duplicates = findDuplicateNotes(notes, [1, 0, 0], { excludeId: 1 });
    expect(duplicates.map((d) => d.note.id)).toEqual([2]);
  });
});

describe('findTextualDuplicates', () => {
  it('matches identical content ignoring case and extra whitespace', () => {
    const notes = [
      makeNote(1, [1, 0, 0], 'Reunião   de hoje'),
      makeNote(2, [1, 0, 0], 'reunião de hoje'),
      makeNote(3, [1, 0, 0], 'outro assunto'),
    ];
    const duplicates = findTextualDuplicates(notes, '  Reunião de hoje  ');
    expect(duplicates.map((d) => d.note.id)).toEqual([1, 2]);
    expect(duplicates[0].score).toBe(1);
  });

  it('returns nothing for empty content', () => {
    expect(findTextualDuplicates([makeNote(1, [1, 0, 0], '   ')], '   ')).toEqual([]);
  });

  it('excludes the note being edited', () => {
    const notes = [makeNote(1, [1, 0, 0], 'igual'), makeNote(2, [1, 0, 0], 'igual')];
    expect(findTextualDuplicates(notes, 'igual', 1).map((d) => d.note.id)).toEqual([2]);
  });
});

describe('detectDuplicates', () => {
  it('uses similarity when an embedding is available', () => {
    const notes = [makeNote(1, [1, 0, 0]), makeNote(2, [0.99, 0.01, 0])];
    // The just-saved note (id 1) is the reference and must never be reported.
    const duplicates = detectDuplicates(notes, 'texto', [1, 0, 0], 1);
    expect(duplicates.map((d) => d.note.id)).toEqual([2]);
  });

  it('falls back to identical text when there is no embedding', () => {
    const notes = [makeNote(1, [1, 0, 0], 'igual'), makeNote(2, [0, 1, 0], 'igual')];
    const duplicates = detectDuplicates(notes, 'igual', [], 1);
    expect(duplicates.map((d) => d.note.id)).toEqual([2]);
  });

  it('never mutates or removes any note', () => {
    const notes = [makeNote(1, [1, 0, 0]), makeNote(2, [1, 0, 0])];
    const snapshot = notes.map((n) => ({ ...n }));
    detectDuplicates(notes, 'nota 1', [1, 0, 0], 1);

    // A detecção é somente leitura: nenhuma nota é apagada, alterada ou
    // adicionada. O único cache esperado é o parse preguiçoso do embedding,
    // que `searchBySimilarity` já fazia antes desta funcionalidade.
    expect(notes).toHaveLength(snapshot.length);
    for (const [index, before] of snapshot.entries()) {
      expect(notes[index].id).toBe(before.id);
      expect(notes[index].content).toBe(before.content);
      expect(notes[index].tags).toBe(before.tags);
      expect(notes[index].pinned).toBe(before.pinned);
      expect(notes[index].embedding).toBe(before.embedding);
    }
  });
});