import {
  LlamaHttpError,
  LlamaInvalidResponseError,
  LlamaNetworkError,
  LlamaTimeoutError,
} from './errors';
import type {
  ChatOptions,
  ChatResult,
  EmbeddingOptions,
  EmbedResult,
  HealthOptions,
  ListModelsOptions,
  LlamaClient,
  LlamaClientOptions,
} from './types';

export const DEFAULT_BASE_URL = 'http://127.0.0.1:8080';
export const DEFAULT_CHAT_TIMEOUT_MS = 180_000;
export const DEFAULT_HEALTH_TIMEOUT_MS = 5_000;
export const DEFAULT_EMBED_TIMEOUT_MS = 60_000;
export const DEFAULT_MODELS_TIMEOUT_MS = 10_000;

export function normalizeBaseUrl(baseUrl?: string): string {
  const url = (baseUrl?.trim() || DEFAULT_BASE_URL).replace(/\/+$/, '');
  return url;
}

interface OpenAiChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

interface OpenAiModelsResponse {
  data?: Array<{ id?: string; object?: string }>;
}

interface OpenAiEmbeddingsResponse {
  data?: Array<{ embedding?: unknown; index?: number }>;
}

function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'number');
}

function handleFetchError(err: unknown, defaultMessage: string): never {
  if (err instanceof LlamaTimeoutError) {
    throw err;
  }
  if (err instanceof DOMException && err.name === 'AbortError') {
    throw new LlamaTimeoutError('Operação cancelada ou atingiu o tempo limite.');
  }
  if (err instanceof Error && err.name === 'AbortError') {
    throw new LlamaTimeoutError('Operação cancelada ou atingiu o tempo limite.');
  }
  throw new LlamaNetworkError(`${defaultMessage}: ${err instanceof Error ? err.message : String(err)}`, err);
}

export function createLlamaClient(options?: LlamaClientOptions): LlamaClient {
  const baseUrl = normalizeBaseUrl(options?.baseUrl);
  const defaultModel = options?.defaultModel;
  const chatTimeoutMs = options?.timeoutMs ?? DEFAULT_CHAT_TIMEOUT_MS;
  const healthTimeoutMs = options?.healthTimeoutMs ?? DEFAULT_HEALTH_TIMEOUT_MS;
  const embedTimeoutMs = options?.embedTimeoutMs ?? DEFAULT_EMBED_TIMEOUT_MS;
  const modelsTimeoutMs = options?.modelsTimeoutMs ?? DEFAULT_MODELS_TIMEOUT_MS;

  /**
   * Executa uma requisição JSON aplicando timeout interno e suporte a
   * cancelamento via AbortSignal, no mesmo padrão usado por chat() e health().
   */
  async function requestJson<T>(params: {
    url: string;
    timeoutMs: number;
    signal?: AbortSignal;
    method: 'GET' | 'POST';
    body?: Record<string, unknown>;
    failMessage: string;
  }): Promise<T> {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;

    const onUserAbort = () => controller.abort();
    if (params.signal) {
      if (params.signal.aborted) {
        throw new LlamaTimeoutError('Operação cancelada antes de iniciar.');
      }
      params.signal.addEventListener('abort', onUserAbort);
    }

    timer = setTimeout(() => {
      controller.abort();
    }, params.timeoutMs);

    let response: Response;
    try {
      response = await fetch(params.url, {
        method: params.method,
        headers: params.body ? { 'Content-Type': 'application/json' } : undefined,
        body: params.body ? JSON.stringify(params.body) : undefined,
        signal: controller.signal,
      });
    } catch (err) {
      if (params.signal?.aborted) {
        throw new LlamaTimeoutError('Operação cancelada pelo usuário.');
      }
      if (controller.signal.aborted) {
        throw new LlamaTimeoutError(
          `Timeout ao aguardar resposta de ${params.url} (${params.timeoutMs}ms).`
        );
      }
      handleFetchError(err, params.failMessage);
    } finally {
      if (timer) clearTimeout(timer);
      if (params.signal) {
        params.signal.removeEventListener('abort', onUserAbort);
      }
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new LlamaHttpError(response.status, text);
    }

    try {
      return (await response.json()) as T;
    } catch (err) {
      throw new LlamaInvalidResponseError(
        `Resposta de ${params.url} não é um JSON válido: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  return {
    baseUrl,

    async health(healthOpts?: HealthOptions): Promise<boolean> {
      const url = `${baseUrl}/health`;
      const controller = new AbortController();
      let timer: ReturnType<typeof setTimeout> | undefined;

      const onUserAbort = () => controller.abort();
      if (healthOpts?.signal) {
        if (healthOpts.signal.aborted) {
          throw new LlamaTimeoutError('Operação cancelada antes de iniciar.');
        }
        healthOpts.signal.addEventListener('abort', onUserAbort);
      }

      timer = setTimeout(() => {
        controller.abort();
      }, healthTimeoutMs);

      try {
        const response = await fetch(url, {
          method: 'GET',
          signal: controller.signal,
        });

        return response.ok;
      } catch (err) {
        if (healthOpts?.signal?.aborted) {
          throw new LlamaTimeoutError('Operação cancelada pelo usuário.');
        }
        if (controller.signal.aborted) {
          throw new LlamaTimeoutError(`Timeout ao aguardar resposta de ${url} (${healthTimeoutMs}ms).`);
        }
        handleFetchError(err, `Falha ao conectar no health check em ${url}`);
      } finally {
        if (timer) clearTimeout(timer);
        if (healthOpts?.signal) {
          healthOpts.signal.removeEventListener('abort', onUserAbort);
        }
      }
    },

    async chat(chatOpts: ChatOptions): Promise<ChatResult> {
      const url = `${baseUrl}/v1/chat/completions`;
      const model = chatOpts.model || defaultModel;

      const body: Record<string, unknown> = {
        messages: chatOpts.messages,
      };

      if (model) {
        body.model = model;
      }
      if (typeof chatOpts.temperature === 'number') {
        body.temperature = chatOpts.temperature;
      }
      if (typeof chatOpts.maxTokens === 'number') {
        body.max_tokens = chatOpts.maxTokens;
      }
      if (typeof chatOpts.enableThinking === 'boolean') {
        body.chat_template_kwargs = {
          enable_thinking: chatOpts.enableThinking,
        };
      }

      const controller = new AbortController();
      let timer: ReturnType<typeof setTimeout> | undefined;

      const onUserAbort = () => controller.abort();
      if (chatOpts.signal) {
        if (chatOpts.signal.aborted) {
          throw new LlamaTimeoutError('Operação cancelada antes de iniciar.');
        }
        chatOpts.signal.addEventListener('abort', onUserAbort);
      }

      timer = setTimeout(() => {
        controller.abort();
      }, chatTimeoutMs);

      let response: Response;
      try {
        response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
      } catch (err) {
        if (chatOpts.signal?.aborted) {
          throw new LlamaTimeoutError('Operação cancelada pelo usuário.');
        }
        if (controller.signal.aborted) {
          throw new LlamaTimeoutError(`Timeout ao aguardar resposta de ${url} (${chatTimeoutMs}ms).`);
        }
        handleFetchError(err, `Falha ao enviar requisição para ${url}`);
      } finally {
        if (timer) clearTimeout(timer);
        if (chatOpts.signal) {
          chatOpts.signal.removeEventListener('abort', onUserAbort);
        }
      }

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new LlamaHttpError(response.status, text);
      }

      let parsed: OpenAiChatCompletionResponse;
      try {
        parsed = (await response.json()) as OpenAiChatCompletionResponse;
      } catch (err) {
        throw new LlamaInvalidResponseError(
          `Resposta de ${url} não é um JSON válido: ${err instanceof Error ? err.message : String(err)}`
        );
      }

      const content = parsed.choices?.[0]?.message?.content;
      if (typeof content !== 'string' || content.trim().length === 0) {
        throw new LlamaInvalidResponseError('O modelo não retornou conteúdo em choices[0].message.content.');
      }

      return {
        content,
      };
    },

    async embed(embedOpts: EmbeddingOptions): Promise<EmbedResult> {
      const url = `${baseUrl}/v1/embeddings`;
      const model = embedOpts.model || defaultModel;

      const body: Record<string, unknown> = { input: embedOpts.input };
      if (model) {
        body.model = model;
      }

      const parsed = await requestJson<OpenAiEmbeddingsResponse>({
        url,
        timeoutMs: embedTimeoutMs,
        signal: embedOpts.signal,
        method: 'POST',
        body,
        failMessage: `Falha ao enviar requisição para ${url}`,
      });

      const entries = Array.isArray(parsed.data) ? parsed.data : null;
      if (!entries || entries.length === 0) {
        throw new LlamaInvalidResponseError('O modelo não retornou embeddings em data[].');
      }

      // O llama-server devolve um item por entrada; respeitamos o índice declarado
      // quando presente para não depender da ordem do array.
      const expectedCount = Array.isArray(embedOpts.input) ? embedOpts.input.length : 1;
      if (entries.length !== expectedCount) {
        throw new LlamaInvalidResponseError(
          `O modelo retornou ${entries.length} embedding(s) para ${expectedCount} entrada(s).`
        );
      }

      const byIndex: Array<number[] | undefined> = new Array(expectedCount);
      for (const [position, entry] of entries.entries()) {
        if (!isNumberArray(entry.embedding)) {
          throw new LlamaInvalidResponseError(
            `O modelo retornou um embedding inválido em data[${position}].embedding.`
          );
        }
        const index =
          typeof entry.index === 'number' && entry.index >= 0 && entry.index < expectedCount
            ? entry.index
            : position;
        byIndex[index] = entry.embedding;
      }

      if (byIndex.some((embedding) => embedding === undefined)) {
        throw new LlamaInvalidResponseError('A resposta de embeddings veio com índices incompletos.');
      }

      return { embeddings: byIndex as number[][] };
    },

    async listModels(listOpts?: ListModelsOptions): Promise<string[]> {
      const url = `${baseUrl}/v1/models`;

      const parsed = await requestJson<OpenAiModelsResponse>({
        url,
        timeoutMs: modelsTimeoutMs,
        signal: listOpts?.signal,
        method: 'GET',
        failMessage: `Falha ao enviar requisição para ${url}`,
      });

      if (!Array.isArray(parsed.data)) {
        throw new LlamaInvalidResponseError('A resposta de /v1/models não possui data[].');
      }

      return parsed.data
        .map((entry) => entry?.id)
        .filter((id): id is string => typeof id === 'string' && id.trim().length > 0);
    },
  };
}
