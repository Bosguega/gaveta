import { cosineSimilarity, searchBySimilarity as searchBySimilarityPackage } from '@bosguega/gaveta-de-bagunca';
import type { Note, SearchResult } from '../types';

export { cosineSimilarity };

/**
 * Reexporta searchBySimilarity do package, convertendo tipos.
 */
export function searchBySimilarity(
  notes: Note[],
  queryEmbedding: number[],
  limit = 5,
  baseThreshold = 0.5,
  queryLength = 0,
): SearchResult[] {
  return searchBySimilarityPackage(
    notes,
    queryEmbedding,
    limit,
    baseThreshold,
    queryLength,
  ) as SearchResult[];
}