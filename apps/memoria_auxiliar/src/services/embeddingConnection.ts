/**
 * Teste de conexão com o llama-server de embeddings.
 * Gera um embedding real de "ping" e valida a dimensão do perfil ativo.
 */
import { createLlamaClient } from '@bosguega/llama-cpp';
import { buildEmbeddingProfile, matchesProfile } from './embeddingProfile';

export interface ConnectionTestResult {
  success: boolean;
  error?: string;
  dimensions?: number;
}

export async function testEmbeddingConnection(
  baseUrl: string,
  model: string,
): Promise<ConnectionTestResult> {
  const profile = buildEmbeddingProfile(model);
  const client = createLlamaClient({ baseUrl, defaultModel: model, embedTimeoutMs: 20_000 });

  try {
    const { embeddings } = await client.embed({ input: 'ping' });
    const embedding = embeddings[0];

    if (!embedding || embedding.length === 0) {
      return { success: false, error: 'O llama-server não retornou um vetor válido.' };
    }

    if (!matchesProfile(embedding, profile)) {
      return {
        success: false,
        error:
          `O modelo "${model}" retornou ${embedding.length} dimensões, ` +
          `mas o perfil ativo exige ${profile.dimensions}.`,
        dimensions: embedding.length,
      };
    }

    return { success: true, dimensions: embedding.length };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}