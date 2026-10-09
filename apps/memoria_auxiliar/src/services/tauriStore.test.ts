import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const invoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({ invoke: (...args: unknown[]) => invoke(...args) }));

import {
  DEFAULT_CHAT_COMMAND,
  DEFAULT_EMBEDDING_COMMAND,
  getChatCommand,
  getEmbeddingCommand,
  migrateLegacyChatCommand,
  setChatCommand,
  setEmbeddingCommand,
  withMcpServersConfig,
} from './tauriStore';

/** Configuração real persistida em versões antigas: default + --mmproj. */
const legacyWithMmproj =
  '"C:\\Trabalhos\\Modelos\\llama-prism-b10709-9a9394a-bin-win-cuda-13.3-x64\\llama-server.exe" ' +
  '-m "C:\\Trabalhos\\Modelos\\Ternary-Bonsai-2-27B-PQ2_0.gguf" ' +
  '--mmproj "C:\\Trabalhos\\Modelos\\Ternary-Bonsai-2-27B-mmproj-Q8_0.gguf" ' +
  '--port 8080 -ngl 99 -c 32768';

describe('withMcpServersConfig', () => {
  beforeEach(() => {
    invoke.mockReset();
  });

  it('acrescenta a flag apontando para o arquivo criado pelo backend', async () => {
    const path = 'C:\\Users\\teste\\AppData\\Roaming\\com.app\\mcp.json';
    invoke.mockResolvedValue(path);

    const result = await withMcpServersConfig('llama-server.exe -m bonsai.gguf');

    expect(invoke).toHaveBeenCalledWith('ensure_mcp_config');
    expect(result).toBe(`llama-server.exe -m bonsai.gguf --mcp-servers-config "${path}"`);
  });

  it('nao duplica a flag quando o comando ja a possui', async () => {
    const result = await withMcpServersConfig(
      'llama-server.exe --mcp-servers-config "C:/x/mcp.json"',
    );

    expect(result).toBe('llama-server.exe --mcp-servers-config "C:/x/mcp.json"');
    expect(invoke).not.toHaveBeenCalled();
  });
});

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

  it('grava a migração do comando legado na primeira leitura', async () => {
    config.llama_chat_command = legacyWithMmproj;

    const result = await getChatCommand();

    expect(result).not.toContain('--mmproj');
    expect(result).toContain('-ctk q8_0');
    expect(config.llama_chat_command).toBe(result);
  });

  it('não altera comandos personalizados persistidos', async () => {
    const custom = '"C:\\outro\\llama-server.exe" -m "C:\\modelos\\outro.gguf" --port 9090';
    config.llama_chat_command = custom;

    await expect(getChatCommand()).resolves.toBe(custom);
    expect(config.llama_chat_command).toBe(custom);
  });
});

describe('configuração padrão do chat (orçamento de VRAM da RTX 3060)', () => {
  it('mantém o contexto de 32k e quantiza o KV cache em q8_0', () => {
    expect(DEFAULT_CHAT_COMMAND).toContain('-c 32768');
    expect(DEFAULT_CHAT_COMMAND).toContain('-ctk q8_0');
    expect(DEFAULT_CHAT_COMMAND).toContain('-ctv q8_0');
  });

  it('não carrega o mmproj — o chat é textual e não envia imagens', () => {
    expect(DEFAULT_CHAT_COMMAND).not.toContain('--mmproj');
  });

  it('comando de embeddings permanece inalterado', () => {
    expect(DEFAULT_EMBEDDING_COMMAND).toBe(
      '"C:\\Trabalhos\\Modelos\\llama-prism-b10709-9a9394a-bin-win-cuda-13.3-x64\\llama-server.exe" ' +
        '-m "C:\\Trabalhos\\Modelos\\bge-m3-q8_0.gguf" --embedding --host 127.0.0.1 --port 8081 -ngl 99',
    );
  });
});

describe('migração de configurações legadas', () => {
  it('substitui o default antigo salvo pelo novo', async () => {
    const legacyDefault =
      '"C:\\Trabalhos\\Modelos\\llama-prism-b10709-9a9394a-bin-win-cuda-13.3-x64\\llama-server.exe" ' +
      '-m "C:\\Trabalhos\\Modelos\\Ternary-Bonsai-2-27B-PQ2_0.gguf" --port 8080 -ngl 99 -c 32768';

    expect(migrateLegacyChatCommand(legacyDefault)).toBe(DEFAULT_CHAT_COMMAND);
  });

  it('remove --mmproj e quantiza o KV, preservando os demais argumentos', () => {
    const migrated = migrateLegacyChatCommand(legacyWithMmproj);

    expect(migrated).not.toContain('--mmproj');
    expect(migrated).toContain('-ctk q8_0');
    expect(migrated).toContain('-ctv q8_0');
    expect(migrated).toContain('-c 32768');
    expect(migrated).toContain('-ngl 99');
    expect(migrated).toContain('--port 8080');
    expect(migrated).toContain('Ternary-Bonsai-2-27B-PQ2_0.gguf');
  });

  it('preserva personalizações reais (sem --mmproj) intactas', () => {
    const custom = '"C:\\outro\\llama-server.exe" -m "C:\\modelos\\outro.gguf" --port 9090 -c 8192';

    expect(migrateLegacyChatCommand(custom)).toBe(custom);
  });

  it('não duplica flags de KV já presentes no comando com --mmproj', () => {
    const withKv = legacyWithMmproj + ' -ctk q8_0 -ctv q8_0';
    const migrated = migrateLegacyChatCommand(withKv);

    expect(migrated.match(/-ctk /g)).toHaveLength(1);
    expect(migrated.match(/-ctv /g)).toHaveLength(1);
  });

  it('migra o formato PowerShell multilinha preservando as personalizações', () => {
    const powershellLegacy =
      '& "C:\\Trabalhos\\Modelos\\llama-prism-b10709-9a9394a-bin-win-cuda-13.3-x64\\llama-server.exe" `\n' +
      '  -m "C:\\Trabalhos\\Modelos\\Ternary-Bonsai-2-27B-PQ2_0.gguf" `\n' +
      '  --mmproj "C:\\Trabalhos\\Modelos\\Ternary-Bonsai-2-27B-mmproj-Q8_0.gguf" `\n' +
      '  -ngl 999 `\n' +
      '  -fa on `\n' +
      '  -c 32768 `\n' +
      '  -np 1 `\n' +
      '  --host 127.0.0.1 `\n' +
      '  --port 8080';

    const migrated = migrateLegacyChatCommand(powershellLegacy);

    expect(migrated).not.toContain('--mmproj');
    expect(migrated).toContain('-ctk q8_0');
    expect(migrated).toContain('-ctv q8_0');
    expect(migrated).toContain('-ngl 999');
    expect(migrated).toContain('-fa on');
    expect(migrated).toContain('-np 1');
    expect(migrated).toContain('--host 127.0.0.1');
    expect(migrated).toContain('--port 8080');
  });
});
