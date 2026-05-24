import { detectProvider, generateEmbedding, getApiKey, sha256 } from '@bosguega/ai-core';
import { getCachedEmbedding, saveCachedEmbedding } from './databaseService';

const DEFAULT_EMBEDDING_MODEL = 'gemini-embedding-001';

export async function getEmbedding(text: string): Promise<number[]> {
  const normalized = text.trim();
  if (!normalized) {
    throw new Error('Texto vazio nao pode gerar embedding.');
  }

  const hash = await sha256(normalized);
  const cached = await getCachedEmbedding(hash);
  if (cached) {
    return cached;
  }

  const apiKey = await getApiKey();
  if (!apiKey) {
    throw new Error('Configure a chave da API nas Configuracoes.');
  }
  if (detectProvider(apiKey) !== 'gemini') {
    throw new Error('Embeddings do memoria_auxiliar ainda usam Google AI Studio.');
  }

  const result = await generateEmbedding(normalized, apiKey, DEFAULT_EMBEDDING_MODEL);
  const embedding = result.embedding;
  await saveCachedEmbedding(hash, embedding);
  return embedding;
}
