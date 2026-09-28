import { invoke } from '@tauri-apps/api/core';
import type { EmbeddingProfile } from '../types';

/**
 * Sincroniza o perfil de embeddings com o banco.
 *
 * Retorna true quando o perfil mudou e o cache/vetores existentes foram
 * invalidados pelo backend.
 */
export async function syncEmbeddingProfile(profile: EmbeddingProfile): Promise<boolean> {
  return invoke<boolean>('sync_embedding_profile', {
    modelName: profile.modelName,
    dimensions: profile.dimensions,
    normalization: profile.normalization,
    version: profile.version,
  });
}