import { invoke } from '@tauri-apps/api/core';
import type { SearchResult } from '../types';

export async function summarizeResults(results: SearchResult[]): Promise<string> {
  if (!results.length) {
    throw new Error('Nao ha resultados para resumir.');
  }

  return invoke<string>('summarize_notes', {
    notes: results.map((result) => result.note.content),
  });
}

export async function generateAnswer(question: string, results: SearchResult[]): Promise<{ answer: string; usedIds: number[] }> {
  // Formata as notas com [MEMORY_ID: N] para a LLM identificar cada uma
  const formattedNotes = results.map(
    (result) => `[MEMORY_ID: ${result.note.id}]\n${result.note.content}`
  );

  const response = await invoke<{ answer: string; used_ids: number[] }>('generate_answer', {
    question,
    contextNotes: formattedNotes,
  });

  return {
    answer: response.answer,
    usedIds: response.used_ids,
  };
}
