import { sha256 } from '@bosguega/ai-core';
import { invoke } from '@tauri-apps/api/core';
import { getCachedEmbedding, saveCachedEmbedding } from './databaseService';

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

  const embedding = await invoke<number[]>('generate_embedding', { text: normalized });
  await saveCachedEmbedding(hash, embedding);
  return embedding;
}
