import {
  LlamaHttpError,
  LlamaInvalidResponseError,
  LlamaNetworkError,
  LlamaTimeoutError,
} from './errors';
import type {
  ChatOptions,
  ChatResult,
  HealthOptions,
  LlamaClient,
  LlamaClientOptions,
} from './types';

export const DEFAULT_BASE_URL = 'http://127.0.0.1:8080';
export const DEFAULT_CHAT_TIMEOUT_MS = 180_000;
export const DEFAULT_HEALTH_TIMEOUT_MS = 5_000;

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
  };
}
