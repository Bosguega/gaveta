import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const invoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({ invoke: (...args: unknown[]) => invoke(...args) }));

import {
  detectServerStatus,
  isServerOwned,
  probeServer,
  startServer,
  startServers,
  stopServer,
} from './llamaServerControl';
import { DEFAULT_CHAT_COMMAND } from './tauriStore';

const originalFetch = globalThis.fetch;

/** Nenhum servidor no ar: o health check falha. */
function mockUnhealthy() {
  globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
}

/** Servidor já no ar respondendo 200. */
function mockHealthy() {
  globalThis.fetch = vi.fn().mockResolvedValue(new Response('OK', { status: 200 }));
}

function embeddingResponse(dimensions: number) {
  return new Response(
    JSON.stringify({ object: 'list', data: [{ embedding: new Array(dimensions).fill(0.1) }] }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}

describe('llamaServerControl', () => {
  beforeEach(() => {
    invoke.mockReset();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('probeServer', () => {
    it('returns true only when the server answers', async () => {
      mockHealthy();
      await expect(probeServer('http://127.0.0.1:8080')).resolves.toBe(true);
    });

    it('returns false when the server is unavailable', async () => {
      mockUnhealthy();
      await expect(probeServer('http://127.0.0.1:8080')).resolves.toBe(false);
    });
  });

  describe('ownership', () => {
    it('delegates ownership query to the backend', async () => {
      invoke.mockResolvedValue(true);
      await expect(isServerOwned('chat')).resolves.toBe(true);
      expect(invoke).toHaveBeenCalledWith('is_llama_server_owned', { kind: 'chat' });
    });

    it('stops only processes owned by the app', async () => {
      invoke.mockResolvedValue(false);
      await expect(stopServer('embedding')).resolves.toBe(false);
      expect(invoke).toHaveBeenCalledWith('stop_llama_server', { kind: 'embedding' });
    });
  });

  describe('detectServerStatus', () => {
    it('reports stopped when nothing answers', async () => {
      mockUnhealthy();
      const result = await detectServerStatus('chat', 'http://127.0.0.1:8080', 'bge-m3');
      expect(result.status).toBe('parado');
    });

    it('reports running when a server was already up', async () => {
      mockHealthy();
      const result = await detectServerStatus('chat', 'http://127.0.0.1:8080', 'bge-m3');
      expect(result.status).toBe('executando');
    });

    it('rejects an embedding server with an incompatible dimension', async () => {
      globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.endsWith('/health')) {
          return new Response('OK', { status: 200 });
        }
        return embeddingResponse(768);
      });

      const result = await detectServerStatus('embedding', 'http://127.0.0.1:8081', 'bge-m3');
      expect(result.status).toBe('erro');
      expect(result.error).toContain('768');
    });

    it('accepts an embedding server with the expected dimension', async () => {
      globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.endsWith('/health')) {
          return new Response('OK', { status: 200 });
        }
        return embeddingResponse(1024);
      });

      const result = await detectServerStatus('embedding', 'http://127.0.0.1:8081', 'bge-m3');
      expect(result.status).toBe('executando');
    });
  });


  describe('startServer', () => {
    it('does not spawn a process when the server already answers', async () => {
      mockHealthy();
      invoke.mockClear();

      const result = await startServer(
        'chat',
        'http://127.0.0.1:8080',
        DEFAULT_CHAT_COMMAND,
        'parado',
        'bge-m3',
      );

      expect(result.status).toBe('executando');
      expect(invoke).not.toHaveBeenCalledWith('start_llama_server', expect.anything());
    });

    it('does not spawn a process while one is already starting', async () => {
      invoke.mockClear();

      const result = await startServer(
        'chat',
        'http://127.0.0.1:8080',
        DEFAULT_CHAT_COMMAND,
        'iniciando',
        'bge-m3',
      );

      expect(result.status).toBe('iniciando');
      expect(invoke).not.toHaveBeenCalled();
    });

    it('rejects an invalid command before spawning anything', async () => {
      mockUnhealthy();
      invoke.mockClear();

      const result = await startServer('chat', 'http://127.0.0.1:8080', '   ', 'parado', 'bge-m3');

      expect(result.status).toBe('erro');
      expect(result.error).toBeTruthy();
      expect(invoke).not.toHaveBeenCalledWith('start_llama_server', expect.anything());
    });

    it('surfaces backend failures when the process cannot be created', async () => {
      mockUnhealthy();
      invoke.mockRejectedValue('Nao foi possivel iniciar');

      const result = await startServer(
        'chat',
        'http://127.0.0.1:8080',
        DEFAULT_CHAT_COMMAND,
        'parado',
        'bge-m3',
      );

      expect(result.status).toBe('erro');
      expect(result.error).toContain('Nao foi possivel iniciar');
    });

    it('does not report running when the process never answers', async () => {
      mockUnhealthy();
      invoke.mockResolvedValue(true);
      vi.useFakeTimers();

      const promise = startServer(
        'chat',
        'http://127.0.0.1:8080',
        DEFAULT_CHAT_COMMAND,
        'parado',
        'bge-m3',
      );
      await vi.advanceTimersByTimeAsync(200_000);
      const result = await promise;
      vi.useRealTimers();

      expect(result.status).toBe('erro');
      expect(result.error).toContain('não respondeu');
    });

    it('spawns the process and reports running once it answers', async () => {
      let healthy = false;
      globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.endsWith('/health')) {
          return healthy ? new Response('OK', { status: 200 }) : new Response('', { status: 503 });
        }
        return embeddingResponse(1024);
      });
      invoke.mockImplementation(async (command: string) => {
        if (command === 'start_llama_server') {
          setTimeout(() => {
            healthy = true;
          }, 100);
        }
        return true;
      });

      const result = await startServer(
        'chat',
        'http://127.0.0.1:8080',
        DEFAULT_CHAT_COMMAND,
        'parado',
        'bge-m3',
      );

      expect(invoke).toHaveBeenCalledWith('start_llama_server', {
        kind: 'chat',
        command: DEFAULT_CHAT_COMMAND,
      });
      expect(result.status).toBe('executando');
    });
  });

  describe('startServers', () => {
    it('starts only the server that is down and preserves the running one', async () => {
      // O chat (8080) já responde; o servidor de embeddings (8081) só sobe depois
      // que o processo for criado pelo app.
      let embeddingUp = false;
      globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.endsWith('/health')) {
          const up = url.includes('8080') || embeddingUp;
          return up ? new Response('OK', { status: 200 }) : new Response('', { status: 503 });
        }
        return embeddingResponse(1024);
      });
      invoke.mockImplementation(async (command: string, args: { kind: string }) => {
        if (command === 'start_llama_server' && args.kind === 'embedding') {
          embeddingUp = true;
        }
        return true;
      });

      const results = await startServers([
        {
          kind: 'chat',
          baseUrl: 'http://127.0.0.1:8080',
          command: DEFAULT_CHAT_COMMAND,
          status: 'parado',
          embeddingModel: 'bge-m3',
        },
        {
          kind: 'embedding',
          baseUrl: 'http://127.0.0.1:8081',
          command: 'llama-server.exe -m bge-m3.gguf',
          status: 'parado',
          embeddingModel: 'bge-m3',
        },
      ]);

      const startedKinds = invoke.mock.calls
        .filter((call) => call[0] === 'start_llama_server')
        .map((call) => (call[1] as { kind: string }).kind);

      expect(startedKinds).toEqual(['embedding']);
      expect(results.chat.status).toBe('executando');
    });

    it('does not duplicate a process that is already running', async () => {
      mockHealthy();
      invoke.mockClear();

      const results = await startServers([
        {
          kind: 'chat',
          baseUrl: 'http://127.0.0.1:8080',
          command: DEFAULT_CHAT_COMMAND,
          status: 'executando',
          embeddingModel: 'bge-m3',
        },
        {
          kind: 'chat',
          baseUrl: 'http://127.0.0.1:8080',
          command: DEFAULT_CHAT_COMMAND,
          status: 'parado',
          embeddingModel: 'bge-m3',
        },
      ]);

      expect(results.chat.status).toBe('executando');
      expect(invoke).not.toHaveBeenCalledWith('start_llama_server', expect.anything());
    });

    it('keeps a failing server from blocking the other', async () => {
      globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.endsWith('/health')) {
          return url.includes('8081')
            ? new Response('', { status: 503 })
            : new Response('OK', { status: 200 });
        }
        return embeddingResponse(1024);
      });
      invoke.mockResolvedValue(true);

      const results = await startServers([
        {
          kind: 'embedding',
          baseUrl: 'http://127.0.0.1:8081',
          command: 'llama-server.exe -m bge-m3.gguf',
          status: 'executando',
          embeddingModel: 'bge-m3',
        },
        {
          kind: 'chat',
          baseUrl: 'http://127.0.0.1:8080',
          command: DEFAULT_CHAT_COMMAND,
          status: 'parado',
          embeddingModel: 'bge-m3',
        },
      ]);

      expect(results.embedding.status).toBe('executando');
      expect(results.chat.status).toBe('executando');
    });
  });
});
