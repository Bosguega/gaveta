import { cosineSimilarity } from '@bosguega/ai-core';
import type { Note, SearchResult } from '../types';

export { cosineSimilarity };

/**
 * Busca notas por similaridade de cosseno utilizando embedding já em memória (ou parseando sob demanda).
 */
export function searchBySimilarity(
  notes: Note[],
  queryEmbedding: number[],
  limit = 5,
  baseThreshold = 0.5,
  queryLength = 0,
): SearchResult[] {
  let threshold = baseThreshold;
  if (queryLength > 100) {
    threshold = Math.max(0.2, baseThreshold - 0.1);
  }

  const results: SearchResult[] = [];

  for (const note of notes) {
    let emb = note.parsedEmbedding;
    if (!emb && note.embedding) {
      try {
        emb = JSON.parse(note.embedding);
        note.parsedEmbedding = emb;
      } catch {
        continue;
      }
    }
    if (!emb || !Array.isArray(emb)) continue;

    const score = cosineSimilarity(queryEmbedding, emb);
    if (score >= threshold) {
      results.push({ note, score });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}