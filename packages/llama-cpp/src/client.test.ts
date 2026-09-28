import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_BASE_URL,
  createLlamaClient,
  normalizeBaseUrl,
} from './client';
import {
  LlamaHttpError,
  LlamaInvalidResponseError,
  LlamaNetworkError,
  LlamaTimeoutError,
} from './errors';

describe('@bosguega/llama-cpp client', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('normalizeBaseUrl & initialization', () => {
    it('uses default base url when omitted', () => {
      const client = createLlamaClient();
      expect(client.baseUrl).toBe(DEFAULT_BASE_URL);
    });

    it('strips trailing slashes from custom baseUrl', () => {
      expect(normalizeBaseUrl('http://192.168.1.50:8080///')).toBe('http://192.168.1.50:8080');
      const client = createLlamaClient({ baseUrl: 'http://localhost:8081/' });
      expect(client.baseUrl).toBe('http://localhost:8081');
    });
  });

  describe('health()', () => {
    it('calls GET /health and returns true on 200 OK', async () => {
      const mockFetch = vi.fn().mockResolvedValue(new Response('OK', { status: 200 }));
      globalThis.fetch = mockFetch;

      const client = createLlamaClient({ baseUrl: 'http://127.0.0.1:8080' });
      const ok = await client.health();

      expect(ok).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe('http://127.0.0.1:8080/health');
      expect(init.method).toBe('GET');
    });

    it('returns false when status is not ok (e.g. 503)', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(new Response('Loading model...', { status: 503 }));

      const client = createLlamaClient();
      const ok = await client.health();
      expect(ok).toBe(false);
    });

    it('handles AbortSignal timeout on health', async () => {
      globalThis.fetch = vi.fn().mockImplementation((_url, init) => {
        return new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => {
            const err = new Error('The operation was aborted');
            err.name = 'AbortError';
            reject(err);
          });
        });
      });

      const client = createLlamaClient({ healthTimeoutMs: 10 });
      await expect(client.health()).rejects.toThrow(LlamaTimeoutError);
    });

    it('throws LlamaNetworkError on connection refused', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

      const client = createLlamaClient();
      await expect(client.health()).rejects.toThrow(LlamaNetworkError);
    });
  });
  describe('chat()', () => {
    it('sends simple text messages payload correctly', async () => {
      let capturedBody: any = null;
      let capturedUrl = '';

      globalThis.fetch = vi.fn().mockImplementation(async (url, init) => {
        capturedUrl = url;
        capturedBody = JSON.parse(init.body);
        return new Response(
          JSON.stringify({
            choices: [{ message: { content: 'Resposta do modelo' } }],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      });

      const client = createLlamaClient({ defaultModel: 'default-model' });
      const result = await client.chat({
        messages: [
          { role: 'system', content: 'Você é um assistente.' },
          { role: 'user', content: 'Olá!' },
        ],
        temperature: 0.2,
        maxTokens: 256,
        enableThinking: false,
      });

      expect(capturedUrl).toBe('http://127.0.0.1:8080/v1/chat/completions');
      expect(capturedBody).toEqual({
        model: 'default-model',
        messages: [
          { role: 'system', content: 'Você é um assistente.' },
          { role: 'user', content: 'Olá!' },
        ],
        temperature: 0.2,
        max_tokens: 256,
        chat_template_kwargs: {
          enable_thinking: false,
        },
      });
      expect(result.content).toBe('Resposta do modelo');
    });

    it('supports multimodal array content (text + image_url)', async () => {
      let capturedBody: any = null;

      globalThis.fetch = vi.fn().mockImplementation(async (_url, init) => {
        capturedBody = JSON.parse(init.body);
        return new Response(
          JSON.stringify({
            choices: [{ message: { content: '{"tags": ["flower", "embroidery"]}' } }],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      });

      const client = createLlamaClient();
      const result = await client.chat({
        model: 'ternary-bonsai-27b',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Descreva a imagem' },
              { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,abc123' } },
            ],
          },
        ],
      });

      expect(capturedBody.model).toBe('ternary-bonsai-27b');
      expect(capturedBody.messages[0].content).toEqual([
        { type: 'text', text: 'Descreva a imagem' },
        { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,abc123' } },
      ]);
      expect(result.content).toBe('{"tags": ["flower", "embroidery"]}');
    });

    it('throws LlamaHttpError on HTTP errors like 500', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response('Internal server error in llama-server', { status: 500 })
      );

      const client = createLlamaClient();
      await expect(
        client.chat({
          messages: [{ role: 'user', content: 'teste' }],
        })
      ).rejects.toThrow(LlamaHttpError);
    });

    it('throws LlamaInvalidResponseError when choices[0].message.content is missing or empty', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ choices: [{ message: { content: '   ' } }] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const client = createLlamaClient();
      await expect(
        client.chat({
          messages: [{ role: 'user', content: 'teste' }],
        })
      ).rejects.toThrow(LlamaInvalidResponseError);
    });

    it('throws LlamaInvalidResponseError on non-JSON body', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response('not-json-content', {
          status: 200,
          headers: { 'Content-Type': 'text/plain' },
        })
      );

      const client = createLlamaClient();
      await expect(
        client.chat({
          messages: [{ role: 'user', content: 'teste' }],
        })
      ).rejects.toThrow(LlamaInvalidResponseError);
    });

    it('respects user AbortSignal', async () => {
      const controller = new AbortController();
      controller.abort();

      const client = createLlamaClient();
      await expect(
        client.chat({
          messages: [{ role: 'user', content: 'teste' }],
          signal: controller.signal,
        })
      ).rejects.toThrow(LlamaTimeoutError);
    });
  });

});
