/**
 * Geração de embeddings
 *
 * Usa o segundo processo llama-server (bge-m3) via @bosguega/llama-cpp.
 * O endpoint de embeddings é independente do endpoint de chat.
 */
import { createLlamaClient, normalizeBaseUrl, DEFAULT_EMBED_TIMEOUT_MS } from '@bosguega/llama-cpp';
import { getCachedEmbedding, saveCachedEmbedding } from './databaseService';
import {
  buildEmbeddingCacheKey,
  buildEmbeddingProfile,
  l2Normalize,
  matchesProfile,
  type EmbeddingProfile,
} from './embeddingProfile';
import { getEmbeddingConfig } from './tauriStore';
import { sha256 } from '../utils/sha256';
import { logger } from '../utils/logger';

export { testEmbeddingConnection } from './embeddingConnection';

export async function getEmbedding(text: string): Promise<number[]> {
  const normalized = text.trim();
  if (!normalized) {
    throw new Error('Texto vazio nao pode gerar embedding.');
  }

  const { baseUrl, model } = await getEmbeddingConfig();
  const profile = buildEmbeddingProfile(model);
  const contentHash = await sha256(normalized);
  const cacheKey = buildEmbeddingCacheKey(profile, contentHash);

  const cached = await getCachedEmbedding(cacheKey);
  if (cached) {
    if (matchesProfile(cached, profile)) {
      logger.log('Embedding', 'Cache hit');
      return cached;
    }
    logger.warn('Embedding', 'Cache ignorado: vetor com dimensão incompatível com o perfil ativo');
  }

  const embedding = await requestEmbedding(baseUrl, model, normalized, profile);
  await saveCachedEmbedding(cacheKey, embedding, profile);
  return embedding;
}

/**
 * Resolve a chave de cache de um texto sem gerar embedding.
 *
 * Usada na exclusão de notas para que o backend consiga remover apenas a entrada
 * de cache que ficou órfã. Devolve `undefined` quando a chave não pode ser
 * montada — nesses casos a limpeza é um no-op, por decisão de segurança.
 */
export async function resolveEmbeddingCacheKey(text?: string): Promise<string | undefined> {
  const normalized = text?.trim();
  if (!normalized) {
    return undefined;
  }

  try {
    const { model } = await getEmbeddingConfig();
    const profile = buildEmbeddingProfile(model);
    return buildEmbeddingCacheKey(profile, await sha256(normalized));
  } catch {
    return undefined;
  }
}

async function requestEmbedding(
  baseUrl: string,
  model: string,
  text: string,
  profile: EmbeddingProfile,
): Promise<number[]> {
  const client = createLlamaClient({
    baseUrl,
    defaultModel: model,
    embedTimeoutMs: DEFAULT_EMBED_TIMEOUT_MS,
  });
  const endpoint = client.baseUrl;

  logger.log('Embedding', `Gerando embedding ${model} em ${endpoint}...`);

  try {
    const { embeddings } = await client.embed({ input: text });
    const embedding = embeddings[0];

    if (!embedding || embedding.length === 0) {
      throw new Error('O llama-server retornou um embedding vazio ou inválido.');
    }

    if (!matchesProfile(embedding, profile)) {
      throw new Error(
        `O modelo "${model}" retornou um embedding com ${embedding.length} dimensões, ` +
          `mas o perfil ativo exige ${profile.dimensions}. ` +
          `Verifique se o llama-server de embeddings está carregando o modelo correto.`
      );
    }

    const normalized = l2Normalize(embedding);
    logger.log('Embedding', `Embedding gerado (${normalized.length} dimensões, normalizado l2)`);
    return normalized;
  } catch (err) {
    // Erros de dimensionality já são autoexplicativos e não devem ser reembalados.
    if (err instanceof Error && err.message.startsWith('O modelo')) {
      throw err;
    }

    const message = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Falha ao conectar com o serviço de embeddings em ${endpoint}.\n` +
        `1. Verifique se o llama-server de embeddings está rodando em ${endpoint}.\n` +
        `2. Confirme que ele foi iniciado com o modelo de embeddings (ex.: ${model}) e a flag --embedding.\n` +
        `Detalhes do erro: ${message}`
    );
  }
}

/** Usado pelo modal de configuração para validar a URL antes de salvar. */
export function normalizeEmbeddingBaseUrl(baseUrl?: string): string {
  return normalizeBaseUrl(baseUrl);
}