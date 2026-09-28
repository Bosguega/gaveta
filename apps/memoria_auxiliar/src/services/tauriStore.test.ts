import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const invoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({ invoke: (...args: unknown[]) => invoke(...args) }));

import {
  DEFAULT_CHAT_COMMAND,
  DEFAULT_EMBEDDING_COMMAND,
  getChatCommand,
  getEmbeddingCommand,
  setChatCommand,
  setEmbeddingCommand,
} from './tauriStore';

describe('persistência dos comandos dos servidores', () => {
  /** Simula o config.json: mapa chave -> valor. */
  let config: Record<string, string>;

  beforeEach(() => {
    config = {};
    invoke.mockReset();
    invoke.mockImplementation(async (command: string, args: Record<string, string>) => {
      if (command === 'get_config') {
        return config[args.key] ?? null;
      }
      if (command === 'set_config') {
        config[args.key] = args.value;
      }
      return null;
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('usa o comando padrão do ambiente quando nada foi salvo', async () => {
    await expect(getChatCommand()).resolves.toBe(DEFAULT_CHAT_COMMAND);
    await expect(getEmbeddingCommand()).resolves.toBe(DEFAULT_EMBEDDING_COMMAND);
  });

  it('os comandos padrão são strings completas e editáveis', () => {
    expect(DEFAULT_CHAT_COMMAND).toContain('llama-server.exe');
    expect(DEFAULT_CHAT_COMMAND).toContain('Ternary-Bonsai-2-27B-PQ2_0.gguf');
    expect(DEFAULT_EMBEDDING_COMMAND).toContain('llama-server.exe');
    expect(DEFAULT_EMBEDDING_COMMAND).toContain('--embedding');
  });

  it('persiste e recupera o comando de chat', async () => {
    const custom = '"C:\\outro\\llama-server.exe" -m "C:\\modelos\\bonsai.gguf" --port 9090';
    await setChatCommand(custom);

    expect(config.llama_chat_command).toBe(custom);
    await expect(getChatCommand()).resolves.toBe(custom);
  });

  it('persiste e recupera o comando de embeddings', async () => {
    const custom = '"C:\\outro\\llama-server.exe" -m "C:\\modelos\\bge-m3.gguf" --embedding --port 9091';
    await setEmbeddingCommand(custom);

    expect(config.llama_embedding_command).toBe(custom);
    await expect(getEmbeddingCommand()).resolves.toBe(custom);
  });

  it('mantém os dois comandos independentes', async () => {
    await setChatCommand('llama-server.exe -m chat.gguf');
    await setEmbeddingCommand('llama-server.exe -m embed.gguf');

    await expect(getChatCommand()).resolves.toBe('llama-server.exe -m chat.gguf');
    await expect(getEmbeddingCommand()).resolves.toBe('llama-server.exe -m embed.gguf');
  });

  it('normaliza espaços em volta ao salvar', async () => {
    await setChatCommand('   llama-server.exe -m chat.gguf   ');
    await expect(getChatCommand()).resolves.toBe('llama-server.exe -m chat.gguf');
  });
});
