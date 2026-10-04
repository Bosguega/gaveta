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

  describe('chat() with tools', () => {
    const searchTool = {
      type: 'function' as const,
      function: {
        name: 'tavily_tavily_search',
        description: 'Busca na web',
        parameters: {
          type: 'object',
          properties: { query: { type: 'string' } },
          required: ['query'],
        },
      },
    };

    it('sends tools in the payload when provided', async () => {
      let capturedBody: any = null;

      globalThis.fetch = vi.fn().mockImplementation(async (_url, init) => {
        capturedBody = JSON.parse(init.body);
        return new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      });

      const client = createLlamaClient();
      await client.chat({
        messages: [{ role: 'user', content: 'oi' }],
        tools: [searchTool],
      });

      expect(capturedBody.tools).toEqual([searchTool]);
    });

    it('omits tools/tool_choice when none are provided (legacy payload preserved)', async () => {
      let capturedBody: any = null;

      globalThis.fetch = vi.fn().mockImplementation(async (_url, init) => {
        capturedBody = JSON.parse(init.body);
        return new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      });

      const client = createLlamaClient();
      await client.chat({ messages: [{ role: 'user', content: 'oi' }] });

      expect(capturedBody).toEqual({ messages: [{ role: 'user', content: 'oi' }] });
    });

    it('forwards tool_choice (string and object forms)', async () => {
      const bodies: any[] = [];

      globalThis.fetch = vi.fn().mockImplementation(async (_url, init) => {
        bodies.push(JSON.parse(init.body));
        return new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      });

      const client = createLlamaClient();
      await client.chat({
        messages: [{ role: 'user', content: 'a' }],
        tools: [searchTool],
        toolChoice: 'auto',
      });
      await client.chat({
        messages: [{ role: 'user', content: 'b' }],
        tools: [searchTool],
        toolChoice: { type: 'function', function: { name: 'tavily_tavily_search' } },
      });

      expect(bodies[0].tool_choice).toBe('auto');
      expect(bodies[1].tool_choice).toEqual({
        type: 'function',
        function: { name: 'tavily_tavily_search' },
      });
    });

    it('parses a tool_calls response with finish_reason "tool_calls"', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [
              {
                finish_reason: 'tool_calls',
                message: {
                  content: '',
                  tool_calls: [
                    {
                      id: 'call_1',
                      type: 'function',
                      function: {
                        name: 'tavily_tavily_search',
                        arguments: '{"query":"cotacao do dolar"}',
                      },
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const client = createLlamaClient();
      const result = await client.chat({ messages: [{ role: 'user', content: 'q' }] });

      expect(result.finishReason).toBe('tool_calls');
      expect(result.content).toBe('');
      expect(result.toolCalls).toEqual([
        {
          id: 'call_1',
          type: 'function',
          function: { name: 'tavily_tavily_search', arguments: '{"query":"cotacao do dolar"}' },
        },
      ]);
    });

    it('preserves multiple tool_calls', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [
              {
                finish_reason: 'tool_calls',
                message: {
                  content: '',
                  tool_calls: [
                    {
                      id: 'a',
                      type: 'function',
                      function: { name: 'tavily_tavily_search', arguments: '{"query":"a"}' },
                    },
                    {
                      id: 'b',
                      type: 'function',
                      function: { name: 'tavily_tavily_extract', arguments: '{"urls":["https://x"]}' },
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const client = createLlamaClient();
      const result = await client.chat({ messages: [{ role: 'user', content: 'q' }] });

      expect(result.toolCalls).toHaveLength(2);
      expect(result.toolCalls?.map((c) => c.function.name)).toEqual([
        'tavily_tavily_search',
        'tavily_tavily_extract',
      ]);
      expect(result.toolCalls?.[1].id).toBe('b');
    });

    it('accepts null/missing content when tool_calls are present', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [
              {
                finish_reason: 'tool_calls',
                message: {
                  content: null,
                  tool_calls: [
                    {
                      id: 'call_1',
                      type: 'function',
                      function: { name: 'tavily_tavily_search', arguments: '{}' },
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const client = createLlamaClient();
      const result = await client.chat({ messages: [{ role: 'user', content: 'q' }] });

      expect(result.content).toBe('');
      expect(result.toolCalls).toHaveLength(1);
    });

    it('sends a tool role message in the continuation', async () => {
      let capturedBody: any = null;

      globalThis.fetch = vi.fn().mockImplementation(async (_url, init) => {
        capturedBody = JSON.parse(init.body);
        return new Response(JSON.stringify({ choices: [{ message: { content: 'resposta final' } }] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      });

      const client = createLlamaClient();
      await client.chat({
        messages: [
          { role: 'user', content: 'qual a cotacao?' },
          {
            role: 'assistant',
            content: null,
            tool_calls: [
              {
                id: 'call_1',
                type: 'function',
                function: { name: 'tavily_tavily_search', arguments: '{"query":"cotacao"}' },
              },
            ],
          },
          { role: 'tool', tool_call_id: 'call_1', content: 'R$ 5,17' },
        ],
      });

      expect(capturedBody.messages[2]).toEqual({
        role: 'tool',
        tool_call_id: 'call_1',
        content: 'R$ 5,17',
      });
    });
  });

  describe('embed()', () => {
    it('posts to /v1/embeddings and returns a single embedding as [[...]]', async () => {
      let capturedUrl = '';
      let capturedBody: any = null;
      let capturedInit: RequestInit | undefined;

      globalThis.fetch = vi.fn().mockImplementation(async (url, init) => {
        capturedUrl = url;
        capturedInit = init;
        capturedBody = JSON.parse(init.body);
        // Formato real devolvido pelo llama-server.
        return new Response(
          JSON.stringify({
            model: 'bge-m3',
            object: 'list',
            usage: { prompt_tokens: 1, total_tokens: 1 },
            data: [{ embedding: [0.1, 0.2, 0.3] }],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      });

      const client = createLlamaClient({ baseUrl: 'http://127.0.0.1:8081', defaultModel: 'bge-m3' });
      const result = await client.embed({ input: 'ping' });

      expect(capturedUrl).toBe('http://127.0.0.1:8081/v1/embeddings');
      expect(capturedInit?.method).toBe('POST');
      expect(capturedBody).toEqual({ input: 'ping', model: 'bge-m3' });
      expect(result.embeddings).toEqual([[0.1, 0.2, 0.3]]);
    });

    it('preserves the input order using the returned index', async () => {
      let capturedBody: any = null;

      globalThis.fetch = vi.fn().mockImplementation(async (_url, init) => {
        capturedBody = JSON.parse(init.body);
        return new Response(
          JSON.stringify({
            object: 'list',
            data: [
              { index: 1, embedding: [9, 9] },
              { index: 0, embedding: [1, 1] },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      });

      const client = createLlamaClient();
      const result = await client.embed({ input: ['primeiro', 'segundo'], model: 'bge-m3' });

      expect(capturedBody).toEqual({ input: ['primeiro', 'segundo'], model: 'bge-m3' });
      expect(result.embeddings).toEqual([
        [1, 1],
        [9, 9],
      ]);
    });

    it('omits model when neither option nor defaultModel is set', async () => {
      let capturedBody: any = null;

      globalThis.fetch = vi.fn().mockImplementation(async (_url, init) => {
        capturedBody = JSON.parse(init.body);
        return new Response(
          JSON.stringify({ object: 'list', data: [{ embedding: [0.5] }] }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      });

      const client = createLlamaClient({ baseUrl: 'http://127.0.0.1:8081' });
      await client.embed({ input: 'ping' });

      expect(capturedBody).toEqual({ input: 'ping' });
    });

    it('throws LlamaHttpError when the server rejects the request', async () => {
      globalThis.fetch = vi
        .fn()
        .mockResolvedValue(new Response('no support for embeddings', { status: 400 }));

      const client = createLlamaClient();
      await expect(client.embed({ input: 'ping' })).rejects.toThrow(LlamaHttpError);
    });

    it('throws LlamaInvalidResponseError when data[] is missing or empty', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ object: 'list' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const client = createLlamaClient();
      await expect(client.embed({ input: 'ping' })).rejects.toThrow(LlamaInvalidResponseError);
    });

    it('throws LlamaInvalidResponseError when the vector is not numeric', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ data: [{ embedding: ['a', 'b'] }] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const client = createLlamaClient();
      await expect(client.embed({ input: 'ping' })).rejects.toThrow(LlamaInvalidResponseError);
    });

    it('throws LlamaInvalidResponseError when the count does not match the inputs', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ data: [{ embedding: [0.1] }] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const client = createLlamaClient();
      await expect(client.embed({ input: ['a', 'b'] })).rejects.toThrow(LlamaInvalidResponseError);
    });

    it('throws LlamaInvalidResponseError on non-JSON body', async () => {
      globalThis.fetch = vi
        .fn()
        .mockResolvedValue(new Response('not-json-content', { status: 200 }));

      const client = createLlamaClient();
      await expect(client.embed({ input: 'ping' })).rejects.toThrow(LlamaInvalidResponseError);
    });

    it('throws LlamaTimeoutError on internal timeout', async () => {
      globalThis.fetch = vi.fn().mockImplementation((_url, init) => {
        return new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => {
            const err = new Error('The operation was aborted');
            err.name = 'AbortError';
            reject(err);
          });
        });
      });

      const client = createLlamaClient({ embedTimeoutMs: 10 });
      await expect(client.embed({ input: 'ping' })).rejects.toThrow(LlamaTimeoutError);
    });

    it('respects user AbortSignal', async () => {
      const controller = new AbortController();
      controller.abort();

      const client = createLlamaClient();
      await expect(
        client.embed({ input: 'ping', signal: controller.signal })
      ).rejects.toThrow(LlamaTimeoutError);
    });

    it('throws LlamaNetworkError on connection refused', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

      const client = createLlamaClient();
      await expect(client.embed({ input: 'ping' })).rejects.toThrow(LlamaNetworkError);
    });
  });

  describe('listModels()', () => {
    it('calls GET /v1/models and returns the model ids', async () => {
      let capturedUrl = '';
      let capturedInit: RequestInit | undefined;

      globalThis.fetch = vi.fn().mockImplementation(async (url, init) => {
        capturedUrl = url;
        capturedInit = init;
        return new Response(
          JSON.stringify({
            models: [{ name: 'bge-m3', object: 'model' }],
            object: 'list',
            data: [{ id: 'bge-m3', object: 'model', owned_by: 'llamacpp' }],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      });

      const client = createLlamaClient({ baseUrl: 'http://127.0.0.1:8081' });
      const models = await client.listModels();

      expect(capturedUrl).toBe('http://127.0.0.1:8081/v1/models');
      expect(capturedInit?.method).toBe('GET');
      expect(models).toEqual(['bge-m3']);
    });

    it('returns an empty list when no model is loaded', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ models: [], object: 'list', data: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const client = createLlamaClient();
      await expect(client.listModels()).resolves.toEqual([]);
    });

    it('ignores entries without a usable id', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ data: [{ id: '  ' }, { object: 'model' }, { id: 'bge-m3' }] }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const client = createLlamaClient();
      await expect(client.listModels()).resolves.toEqual(['bge-m3']);
    });

    it('throws LlamaInvalidResponseError when data[] is absent', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ models: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const client = createLlamaClient();
      await expect(client.listModels()).rejects.toThrow(LlamaInvalidResponseError);
    });

    it('throws LlamaHttpError on server error', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(new Response('boom', { status: 500 }));

      const client = createLlamaClient();
      await expect(client.listModels()).rejects.toThrow(LlamaHttpError);
    });

    it('throws LlamaTimeoutError on internal timeout', async () => {
      globalThis.fetch = vi.fn().mockImplementation((_url, init) => {
        return new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => {
            const err = new Error('The operation was aborted');
            err.name = 'AbortError';
            reject(err);
          });
        });
      });

      const client = createLlamaClient({ modelsTimeoutMs: 10 });
      await expect(client.listModels()).rejects.toThrow(LlamaTimeoutError);
    });

    it('throws LlamaNetworkError on connection refused', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

      const client = createLlamaClient();
      await expect(client.listModels()).rejects.toThrow(LlamaNetworkError);
    });
  });

  describe('listTools()', () => {
    it('calls GET /tools and returns normalized definitions', async () => {
      let capturedUrl = '';
      let capturedInit: RequestInit | undefined;

      globalThis.fetch = vi.fn().mockImplementation(async (url, init) => {
        capturedUrl = url;
        capturedInit = init;
        return new Response(
          JSON.stringify([
            {
              display_name: 'tavily_tavily_search',
              tool: 'tavily_tavily_search',
              type: 'mcp',
              permissions: { write: false },
              uses_cwd: false,
              definition: {
                type: 'function',
                function: {
                  name: 'tavily_tavily_search',
                  description: 'Busca na web',
                  parameters: {
                    type: 'object',
                    properties: { query: { type: 'string' } },
                    required: ['query'],
                  },
                },
              },
            },
          ]),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      });

      const client = createLlamaClient({ baseUrl: 'http://127.0.0.1:8080' });
      const tools = await client.listTools();

      expect(capturedUrl).toBe('http://127.0.0.1:8080/tools');
      expect(capturedInit?.method).toBe('GET');
      expect(tools).toEqual([
        {
          type: 'function',
          function: {
            name: 'tavily_tavily_search',
            description: 'Busca na web',
            parameters: {
              type: 'object',
              properties: { query: { type: 'string' } },
              required: ['query'],
            },
          },
        },
      ]);
    });

    it('extracts only valid function definitions (drops malformed entries)', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify([
            { tool: 'broken' },
            { definition: { type: 'other', function: { name: 'not_a_function' } } },
            { definition: { type: 'function', function: { description: 'sem nome' } } },
            { definition: { type: 'function', function: { name: 'ok_tool' } } },
          ]),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const client = createLlamaClient();
      await expect(client.listTools()).resolves.toEqual([
        { type: 'function', function: { name: 'ok_tool' } },
      ]);
    });

    it('throws LlamaInvalidResponseError when the body is not an array', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ tools: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const client = createLlamaClient();
      await expect(client.listTools()).rejects.toThrow(LlamaInvalidResponseError);
    });

    it('propagates HTTP errors as LlamaHttpError', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(new Response('boom', { status: 500 }));

      const client = createLlamaClient();
      await expect(client.listTools()).rejects.toThrow(LlamaHttpError);
    });
  });

  describe('callTool()', () => {
    it('calls POST /tools with the tool name and params', async () => {
      let capturedUrl = '';
      let capturedInit: RequestInit | undefined;
      let capturedBody: any = null;

      globalThis.fetch = vi.fn().mockImplementation(async (url, init) => {
        capturedUrl = url;
        capturedInit = init;
        capturedBody = JSON.parse(init.body);
        return new Response(JSON.stringify({ plain_text_response: 'resultado' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      });

      const client = createLlamaClient({ baseUrl: 'http://127.0.0.1:8080' });
      await client.callTool('tavily_tavily_search', { query: 'cotacao do dolar' });

      expect(capturedUrl).toBe('http://127.0.0.1:8080/tools');
      expect(capturedInit?.method).toBe('POST');
      expect(capturedBody).toEqual({
        tool: 'tavily_tavily_search',
        params: { query: 'cotacao do dolar' },
      });
    });

    it('returns the plain_text_response without interpreting it', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ plain_text_response: 'Conteudo da pagina' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const client = createLlamaClient();
      const result = await client.callTool('tavily_tavily_extract', { urls: ['https://x'] });

      expect(result.plainTextResponse).toBe('Conteudo da pagina');
    });

    it('sends an empty params object when params are omitted', async () => {
      let capturedBody: any = null;

      globalThis.fetch = vi.fn().mockImplementation(async (_url, init) => {
        capturedBody = JSON.parse(init.body);
        return new Response(JSON.stringify({ plain_text_response: '' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      });

      const client = createLlamaClient();
      await client.callTool('tool_without_params');

      expect(capturedBody).toEqual({ tool: 'tool_without_params', params: {} });
    });

    it('propagates HTTP errors as LlamaHttpError', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(new Response('tool failed', { status: 500 }));

      const client = createLlamaClient();
      await expect(
        client.callTool('tavily_tavily_search', { query: 'x' })
      ).rejects.toThrow(LlamaHttpError);
    });

    it('throws LlamaInvalidResponseError on non-JSON body', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response('not-json', { status: 200, headers: { 'Content-Type': 'text/plain' } })
      );

      const client = createLlamaClient();
      await expect(
        client.callTool('tavily_tavily_search', { query: 'x' })
      ).rejects.toThrow(LlamaInvalidResponseError);
    });
  });
});
