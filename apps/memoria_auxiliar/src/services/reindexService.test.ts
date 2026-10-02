import { describe, expect, it, vi } from 'vitest';
import type { Note } from '../types';
import { reindexNotes, selectNotesToReindex } from './reindexService';

function note(id: number, embedding: string): Note {
  return {
    id,
    content: `conteudo ${id}`,
    embedding,
    tags: `tag${id}`,
    pinned: false,
    reminder_at: null,
    created_at: '2026-05-05T00:00:00Z',
  };
}

const okDeps = () => ({
  getEmbedding: vi.fn(async () => [0.5, 0.5]),
  updateNote: vi.fn(async () => {}),
});

describe('selectNotesToReindex', () => {
  it('selects only notes without a valid embedding', () => {
    const selected = selectNotesToReindex([
      note(1, '[0.1,0.2]'),
      note(2, '[]'),
      note(3, 'nao-json'),
    ]);

    expect(selected.map((n) => n.id)).toEqual([2, 3]);
  });
});

describe('reindexNotes', () => {
  it('reindexes a note that has no embedding', async () => {
    const deps = okDeps();
    const target = note(1, '[]');

    const result = await reindexNotes([target], deps);

    expect(result).toMatchObject({ total: 1, reindexed: 1, failed: 0, skipped: 0 });
    expect(deps.updateNote).toHaveBeenCalledWith(1, 'conteudo 1', [0.5, 0.5], 'tag1', false, null);
    expect(target.parsedEmbedding).toEqual([0.5, 0.5]);
  });

  it('does not touch notes that already have a valid embedding', async () => {
    const deps = okDeps();

    const result = await reindexNotes([note(1, '[0.1,0.2]')], deps);

    expect(result).toMatchObject({ total: 0, reindexed: 0, skipped: 1 });
    expect(deps.getEmbedding).not.toHaveBeenCalled();
    expect(deps.updateNote).not.toHaveBeenCalled();
  });

  it('keeps existing embeddings intact when the embedding server fails', async () => {
    const deps = {
      getEmbedding: vi.fn(async () => {
        throw new Error('servidor indisponivel');
      }),
      updateNote: vi.fn(async () => {}),
    };

    const result = await reindexNotes([note(1, '[]')], deps);

    expect(result).toMatchObject({ reindexed: 0, failed: 1 });
    expect(deps.updateNote).not.toHaveBeenCalled();
  });

  it('continues the batch after a failure and reports progress', async () => {
    const getEmbedding = vi.fn()
      .mockRejectedValueOnce(new Error('falhou'))
      .mockResolvedValueOnce([0.5, 0.5]);
    const updateNote = vi.fn(async () => {});
    const progress: number[] = [];

    const result = await reindexNotes([note(1, '[]'), note(2, '[]')], {
      getEmbedding,
      updateNote,
      onProgress: (p) => progress.push(p.processed),
    });

    expect(result).toMatchObject({ reindexed: 1, failed: 1, processed: 2 });
    expect(updateNote).toHaveBeenCalledTimes(1);
    expect(progress[progress.length - 1]).toBe(2);
  });

  it('does not persist an empty vector returned by the server', async () => {
    const deps = { getEmbedding: vi.fn(async () => []), updateNote: vi.fn(async () => {}) };

    const result = await reindexNotes([note(1, '[]')], deps);

    expect(result).toMatchObject({ reindexed: 0, failed: 1 });
    expect(deps.updateNote).not.toHaveBeenCalled();
  });
});