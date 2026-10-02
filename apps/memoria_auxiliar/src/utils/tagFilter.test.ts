import { describe, expect, it } from 'vitest';
import type { Note } from '../types';
import { filterNotesByTag, noteMatchesTag } from './tagFilter';
import { searchBySimilarity } from '../services/similarityService';

function note(id: number, tags?: string, embedding = '[1,0]'): Note {
  return {
    id,
    content: `nota ${id}`,
    embedding,
    tags,
    created_at: '2026-05-05T00:00:00Z',
  };
}

describe('noteMatchesTag', () => {
  it('aceita qualquer nota quando nenhuma tag esta selecionada', () => {
    expect(noteMatchesTag(note(1, 'trabalho'), null)).toBe(true);
    expect(noteMatchesTag(note(2), null)).toBe(true);
  });

  it('compara ignorando maiusculas e espacos', () => {
    expect(noteMatchesTag(note(1, 'Trabalho, urgente'), 'trabalho')).toBe(true);
    expect(noteMatchesTag(note(1, 'urgente , Trabalho'), 'TRABALHO')).toBe(true);
  });

  it('nao casa notas sem tags ou de outras tags', () => {
    expect(noteMatchesTag(note(1), 'trabalho')).toBe(false);
    expect(noteMatchesTag(note(1, 'pessoal'), 'trabalho')).toBe(false);
  });

  it('nao confunde tags que sao prefixo de outras', () => {
    expect(noteMatchesTag(note(1, 'trabalho'), 'tra')).toBe(false);
  });
});

describe('filterNotesByTag', () => {
  it('devolve a propria lista quando nenhuma tag esta selecionada', () => {
    const notes = [note(1, 'trabalho'), note(2, 'pessoal')];
    expect(filterNotesByTag(notes, null)).toBe(notes);
  });

  it('mantem apenas as notas da tag selecionada', () => {
    const notes = [note(1, 'trabalho'), note(2, 'pessoal'), note(3, 'urgente, trabalho')];
    expect(filterNotesByTag(notes, 'trabalho').map((n) => n.id)).toEqual([1, 3]);
  });
});

describe('busca com filtro de tag aplicado antes do limite', () => {
  it('preenche o limite com notas da tag, e nao com as melhores globais', () => {
    // 3 notas muito similares fora da tag e 2 dentro da tag.
    const notes = [
      note(1, 'pessoal', '[1,0]'),
      note(2, 'pessoal', '[0.99,0.01]'),
      note(3, 'pessoal', '[0.98,0.02]'),
      note(4, 'trabalho', '[0.6,0.4]'),
      note(5, 'trabalho', '[0.55,0.45]'),
    ];

    // Sem filtrar antes, o limite seria ocupado por notas de outras tags.
    const semFiltro = searchBySimilarity(notes, [1, 0], 2, 0.45, 0);
    expect(semFiltro.map((r) => r.note.id)).toEqual([1, 2]);

    // Filtrando antes, o limite é preenchido por notas que o usuario vera.
    const comFiltro = searchBySimilarity(
      filterNotesByTag(notes, 'trabalho'),
      [1, 0],
      2,
      0.45,
      0,
    );
    expect(comFiltro.map((r) => r.note.id)).toEqual([4, 5]);
  });

  it('preserva o resultado global quando nenhuma tag esta selecionada', () => {
    const notes = [note(1, 'pessoal', '[1,0]'), note(2, 'trabalho', '[0.6,0.4]')];

    const comFiltro = searchBySimilarity(
      filterNotesByTag(notes, null),
      [1, 0],
      10,
      0.45,
      0,
    );
    expect(comFiltro.map((r) => r.note.id)).toEqual([1, 2]);
  });

  it('nao traz notas de outra tag mesmo quando elas dominam a similaridade', () => {
    const notes = [note(1, 'pessoal', '[1,0]'), note(2, 'trabalho', '[0.6,0.4]')];

    const comFiltro = searchBySimilarity(
      filterNotesByTag(notes, 'trabalho'),
      [1, 0],
      10,
      0.45,
      0,
    );
    expect(comFiltro.map((r) => r.note.id)).toEqual([2]);
  });
});
