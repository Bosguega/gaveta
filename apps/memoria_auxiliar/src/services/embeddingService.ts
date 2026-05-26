import { getAiBaseUrl, sha256 } from '@bosguega/ai-core';
import { getCachedEmbedding, saveCachedEmbedding } from './databaseService';
import { logger } from '../utils/logger';

const OLLAMA_EMBED_MODEL = 'bge-m3';
const OLLAMA_EMBED_DIMENSION = 1024;
const OLLAMA_TIMEOUT_MS = 30000;

export async function getEmbedding(text: string): Promise<number[]> {
  const normalized = text.trim();
  if (!normalized) {
    throw new Error('Texto vazio nao pode gerar embedding.');
  }

  const hash = await sha256(normalized);
  const cached = await getCachedEmbedding(hash);
  if (cached) {
    logger.log('Embedding', 'Cache hit');
    return cached;
  }

  const embedding = await getOllamaEmbedding(normalized);
  await saveCachedEmbedding(hash, embedding);
  return embedding;
}

async function getOllamaEmbedding(text: string): Promise<number[]> {
  const baseUrl = (await getAiBaseUrl()).replace(/\/+$/, '');
  const url = `${baseUrl}/api/embeddings`;

  logger.log('Embedding', `Gerando embedding bge-m3...`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_EMBED_MODEL,
        prompt: text,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new Error(
        `Ollama embedding falhou (HTTP ${response.status}): ${errorBody || response.statusText}`
      );
    }

    const data = await response.json();
    const embedding: number[] = data.embedding;

    if (!Array.isArray(embedding) || embedding.length === 0) {
      throw new Error('Ollama retornou um embedding vazio ou inválido.');
    }

    if (embedding.length !== OLLAMA_EMBED_DIMENSION) {
      logger.warn('Embedding', `Dimensão inesperada: ${embedding.length} (esperado ${OLLAMA_EMBED_DIMENSION})`);
    }

    logger.log('Embedding', `Embedding bge-m3 gerado (${embedding.length} dimensões)`);
    return embedding;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error(`Timeout ao conectar com Ollama em ${url}. Verifique se o servidor está rodando.`);
    }
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Falha ao conectar com o serviço de embeddings no Ollama (${baseUrl}).\n` +
      `1. Verifique se o Ollama está rodando no endereço informado.\n` +
      `2. Certifique-se de ter baixado o modelo bge-m3 executando 'ollama pull bge-m3' no seu terminal.\n` +
      `Detalhes do erro: ${message}`
    );
  } finally {
    clearTimeout(timeout);
  }
}

export async function testOllamaEmbedding(customBaseUrl?: string): Promise<{ success: boolean; error?: string }> {
  const baseUrl = (customBaseUrl || await getAiBaseUrl()).replace(/\/+$/, '');
  const url = `${baseUrl}/api/embeddings`;
  
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000); // 15s para teste de conexão
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_EMBED_MODEL,
        prompt: 'ping',
      }),
      signal: controller.signal,
    });
    
    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      return { success: false, error: `HTTP ${response.status}: ${errText || response.statusText}` };
    }
    
    const data = await response.json();
    if (Array.isArray(data.embedding) && data.embedding.length > 0) {
      return { success: true };
    }
    return { success: false, error: 'O Ollama não retornou um vetor válido.' };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return { success: false, error: `Timeout ao conectar com Ollama em ${url}` };
    }
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  } finally {
    clearTimeout(timeout);
  }
}