import { logger } from '../utils/logger';
import type { Note, SearchResult } from '../types';

/**
 * Similaridade de cosseno.
 *
 * O cálculo permanece no app: ele faz parte da busca semântica das notas e
 * não é responsabilidade do cliente HTTP de llama-server.
 * Vetores de dimensões diferentes são incompatíveis e retornam 0 — nunca
 * uma similaridade "inventada".
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) {
    return 0;
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let index = 0; index < a.length; index += 1) {
    dot += a[index] * b[index];
    normA += a[index] * a[index];
    normB += b[index] * b[index];
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function parseNoteEmbedding(note: Note): number[] | null {
  let embedding = note.parsedEmbedding;
  if (!embedding && note.embedding) {
    try {
      embedding = JSON.parse(note.embedding);
      note.parsedEmbedding = embedding;
    } catch {
      return null;
    }
  }

  if (!embedding || !Array.isArray(embedding) || embedding.length === 0) {
    return null;
  }

  return embedding;
}

/**
 * Busca notas por similaridade de cosseno utilizando embedding já em memória (ou parseando sob demanda).
 * Notas cujo vetor tenha dimensão diferente da consulta são ignoradas explicitamente.
 */
export function searchBySimilarity(
  notes: Note[],
  queryEmbedding: number[],
  limit = 5,
  baseThreshold = 0.5,
  queryLength = 0,
): SearchResult[] {
  if (queryEmbedding.length === 0) {
    logger.warn('Busca', 'Consulta sem embedding válido. Busca semântica ignorada.');
    return [];
  }

  let threshold = baseThreshold;
  if (queryLength > 100) {
    threshold = Math.max(0.2, baseThreshold - 0.1);
  }

  const results: SearchResult[] = [];
  let skipped = 0;

  for (const note of notes) {
    const emb = parseNoteEmbedding(note);
    if (!emb) continue;

    if (emb.length !== queryEmbedding.length) {
      skipped += 1;
      continue;
    }

    const score = cosineSimilarity(queryEmbedding, emb);
    if (score >= threshold) {
      results.push({ note, score });
    }
  }

  if (skipped > 0) {
    logger.warn(
      'Busca',
      `${skipped} nota(s) ignorada(s): embedding com dimensão diferente de ${queryEmbedding.length}`
    );
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}