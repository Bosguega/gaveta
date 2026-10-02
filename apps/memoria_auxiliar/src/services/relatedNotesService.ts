import { hasValidEmbedding, searchBySimilarity } from './similarityService';
import type { Note, SearchResult } from '../types';

/** Uma nota acima deste score é provavelmente uma duplicata da outra. */
const DUPLICATE_THRESHOLD = 0.95;

/** Notas "relacionadas" são menos exigentes: o objetivo é sugerir, não afirmar igualdade. */
const RELATED_THRESHOLD = 0.7;

/**
 * Notas semanticamente parecidas com uma nota de referência.
 *
 * Reaproveita a busca por similaridade já existente: o embedding da própria nota
 * é a consulta, e a nota de referência é removida dos candidatos.
 */
export function findRelatedNotes(notes: Note[], reference: Note, limit = 5): SearchResult[] {
  const embedding = reference.parsedEmbedding;
  if (!embedding || embedding.length === 0) return [];

  return searchBySimilarity(
    notes.filter((note) => note.id !== reference.id),
    embedding,
    limit,
    // queryLength 0 desativa o ajuste de threshold para consultas longas: aqui a
    // consulta é a própria nota, não uma pergunta do usuário.
    RELATED_THRESHOLD,
    0,
  );
}

/**
 * Notas praticamente idênticas ao conteúdo informado.
 *
 * Usado apenas para AVISAR o usuário de possíveis duplicatas ao criar ou editar
 * uma nota. Esta função nunca executa nenhuma escrita: apagar ou manter é
 * sempre decisão do usuário.
 */
export function findDuplicateNotes(
  notes: Note[],
  embedding: number[],
  options: { excludeId?: number; limit?: number; threshold?: number } = {},
): SearchResult[] {
  if (embedding.length === 0) return [];

  const { excludeId, limit = 5, threshold = DUPLICATE_THRESHOLD } = options;

  return searchBySimilarity(
    notes.filter((note) => note.id !== excludeId),
    embedding,
    limit,
    threshold,
    0,
  );
}

/**
 * Fallback textual para quando não há embedding disponível.
 *
 * Sem vetor não é possível comparar semanticamente, então a verificação
 * restringe-se a conteúdo idêntico — o suficiente para não perder o aviso
 * quando o servidor de embeddings está offline.
 */
export function findTextualDuplicates(
  notes: Note[],
  content: string,
  excludeId?: number,
  limit = 5,
): SearchResult[] {
  const target = normalizeForComparison(content);
  if (!target) return [];

  return notes
    .filter((note) => note.id !== excludeId && normalizeForComparison(note.content) === target)
    .slice(0, limit)
    .map((note) => ({ note, score: 1 }));
}

/**
 * Escolhe como detectar duplicatas: semanticamente quando há vetor, por texto
 * idêntico quando não há.
 */
export function detectDuplicates(
  notes: Note[],
  content: string,
  embedding: number[],
  excludeId?: number,
  limit = 5,
): SearchResult[] {
  if (embedding.length > 0) {
    return findDuplicateNotes(notes, embedding, { excludeId, limit });
  }
  return findTextualDuplicates(notes, content, excludeId, limit);
}

function normalizeForComparison(content: string): string {
  return content.trim().replace(/\s+/g, ' ').toLowerCase();
}
