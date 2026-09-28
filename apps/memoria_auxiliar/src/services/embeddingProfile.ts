/**
 * Perfis de embeddings
 *
 * O perfil identifica o pipeline que gerou um vetor. Ele é gravado no banco
 * (tabela embedding_profile) e faz parte da chave do cache, para que uma
 * troca de modelo/dimensão invalide automaticamente os vetores antigos em vez
 * de misturar espaços vetoriais incomparáveis.
 */
import type { EmbeddingProfile } from '../types';

export type { EmbeddingProfile };

export const EMBEDDING_DIMENSIONS = 1024;
export const EMBEDDING_NORMALIZATION = 'l2' as const;
export const EMBEDDING_VERSION = 'v1';

/** Monta o perfil a partir do modelo de embeddings configurado no app. */
export function buildEmbeddingProfile(modelName: string): EmbeddingProfile {
  return {
    modelName,
    dimensions: EMBEDDING_DIMENSIONS,
    normalization: EMBEDDING_NORMALIZATION,
    version: EMBEDDING_VERSION,
  };
}

/** Chave do cache no formato `<modelo>:<dimensão>:<normalização>:<versão>:<sha256>`. */
export function buildEmbeddingCacheKey(profile: EmbeddingProfile, contentHash: string): string {
  return `${profile.modelName}:${profile.dimensions}:${profile.normalization}:${profile.version}:${contentHash}`;
}

/** Normaliza o vetor para norma L2 (unitário). */
export function l2Normalize(embedding: number[]): number[] {
  let sumSquares = 0;
  for (const value of embedding) {
    sumSquares += value * value;
  }

  const norm = Math.sqrt(sumSquares);
  if (norm === 0) {
    return embedding;
  }

  return embedding.map((value) => value / norm);
}

/** Indica se o vetor é compatível com o perfil ativo. */
export function matchesProfile(embedding: number[], profile: EmbeddingProfile): boolean {
  return Array.isArray(embedding) && embedding.length === profile.dimensions;
}