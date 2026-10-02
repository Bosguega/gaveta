import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Note, SearchResult } from '../types';
import { filterNotesByTag } from '../utils/tagFilter';
import { summarizeResults } from './llmService';

const chatMock = vi.fn(async (_request: { messages: { content: string }[] }) => ({
  content: 'resumo gerado',
}));

vi.mock('@bosguega/llama-cpp', () => ({
  createLlamaClient: () => ({
    baseUrl: 'http://localhost:11434',
    chat: chatMock,
  }),
}));

vi.mock('./tauriStore', () => ({
  getChatConfig: async () => ({ baseUrl: 'http://localhost:11434', model: 'fake-model' }),
}));

function note(id: number, tags?: string): Note {
  return {
    id,
    content: `conteudo da nota ${id}`,
    embedding: '[1,0]',
    tags,
    created_at: '2026-05-05T00:00:00Z',
  };
}

function displayedResultsOf(notes: Note[], tag: string | null): SearchResult[] {
  // Reproduz o computed displayedResults: sem busca ativa, score 0 para todas.
  return notes
    .filter((n) => filterNotesByTag([n], tag).length > 0)
    .map((n) => ({ note: n, score: 0 }));
}

beforeEach(() => {
  chatMock.mockClear();
});

describe('summarizeResults', () => {
  it('rejeita lista vazia', async () => {
    await expect(summarizeResults([])).rejects.toThrow(/resultados/i);
  });

  it('resume notas exibidas sem busca ativa (score 0)', async () => {
    // displayedResults sem busca ativa: todas as notas com score 0.
    // Antes da correcao, generateSummary filtrava score > 0 e esta lista
    // chegava vazia em summarizeResults, que lancava erro.
    const displayed = displayedResultsOf([note(1), note(2)], null);

    await expect(summarizeResults(displayed)).resolves.toBe('resumo gerado');
    expect(chatMock).toHaveBeenCalledTimes(1);
  });

  it('inclui no prompt as notas ja filtradas por tag', async () => {
    const notes = [note(1, 'trabalho'), note(2, 'pessoal')];
    const displayed = displayedResultsOf(notes, 'trabalho');

    await summarizeResults(displayed);

    const { messages } = chatMock.mock.calls[0][0];
    expect(messages[0].content).toContain('conteudo da nota 1');
    expect(messages[0].content).not.toContain('conteudo da nota 2');
  });
});
