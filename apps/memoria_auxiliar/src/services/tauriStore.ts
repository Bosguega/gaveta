/**
 * Configuração da infraestrutura local de IA.
 *
 * Decisão do app: dois processos llama-server independentes.
 *   - chat       → Ternary-Bonsai-2-27B (geração de texto)
 *   - embeddings → bge-m3 (vetores)
 *
 * A configuração é persistida no config.json do app através dos mesmos
 * comandos Tauri usados pelas demais preferências (get_config/set_config).
 */
import { invoke } from '@tauri-apps/api/core';
import type { ChatLlamaConfig, EmbeddingLlamaConfig } from '../types';

export interface KeyValueStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

/** Store genérico de preferências, usado por tema, estatísticas e demais flags. */
export const tauriStore: KeyValueStore = {
  get: (key) => invoke<string | null>('get_config', { key }),
  set: (key, value) => invoke('set_config', { key, value }),
  remove: (key) => invoke('remove_config', { key }),
};

const KEY_CHAT_BASE_URL = 'llama_chat_base_url';
const KEY_CHAT_MODEL = 'llama_chat_model';
const KEY_EMBEDDING_BASE_URL = 'llama_embedding_base_url';
const KEY_EMBEDDING_MODEL = 'llama_embedding_model';
const KEY_CHAT_COMMAND = 'llama_chat_command';
const KEY_EMBEDDING_COMMAND = 'llama_embedding_command';

export const DEFAULT_CHAT_BASE_URL = 'http://127.0.0.1:8080';
export const DEFAULT_EMBEDDING_BASE_URL = 'http://127.0.0.1:8081';
export const DEFAULT_CHAT_MODEL = 'ternary-bonsai-2-27b';
export const DEFAULT_EMBEDDING_MODEL = 'bge-m3';

/**
 * Comandos de inicialização padrão.
 *
 * São apenas um ponto de partida preenchido com o ambiente atual: ficam
 * editáveis pelo usuário e são armazenados como uma única string, sem
 * decomposição em campos (modelo, contexto, pooling, ngl...).
 */
export const DEFAULT_CHAT_COMMAND =
  '"C:\\Trabalhos\\Modelos\\llama-prism-b10709-9a9394a-bin-win-cuda-13.3-x64\\llama-server.exe" ' +
  '-m "C:\\Trabalhos\\Modelos\\Ternary-Bonsai-2-27B-PQ2_0.gguf" --port 8080 -ngl 99 -c 32768 ' +
  '-ctk q8_0 -ctv q8_0';

/**
 * Default anterior, mantido apenas para reconhecer configurações antigas.
 *
 * Um valor salvo igual a ele nunca foi personalização do usuário: é o antigo
 * default e deve ser substituído integralmente pelo novo.
 */
const LEGACY_DEFAULT_CHAT_COMMAND =
  '"C:\\Trabalhos\\Modelos\\llama-prism-b10709-9a9394a-bin-win-cuda-13.3-x64\\llama-server.exe" ' +
  '-m "C:\\Trabalhos\\Modelos\\Ternary-Bonsai-2-27B-PQ2_0.gguf" --port 8080 -ngl 99 -c 32768';

/**
 * Normaliza comandos herdados de versões antigas sem tocar em personalizações reais.
 *
 * Dois casos conhecidos:
 *   1. igual ao default antigo → troca integral pelo novo;
 *   2. contém `--mmproj` → remove apenas o `--mmproj` (o chat é textual e nunca
 *      envia imagens; o arquivo consumia ~630 MB de VRAM e forçava paginação para
 *      a memória compartilhada na RTX de 12 GB) e acrescenta a quantização q8_0
 *      do KV cache, preservando os demais argumentos.
 *
 * Qualquer outro comando é devolvido intacto.
 */
export function migrateLegacyChatCommand(command: string): string {
  if (command === LEGACY_DEFAULT_CHAT_COMMAND) {
    return DEFAULT_CHAT_COMMAND;
  }

  if (!command.includes('--mmproj')) {
    return command;
  }

  let migrated = command.replace(
    /\s*--mmproj(?:[=\s]+)(?:"[^"]*"|'[^']*'|\S+)/g,
    '',
  );
  if (!migrated.includes('-ctk ')) migrated += ' -ctk q8_0';
  if (!migrated.includes('-ctv ')) migrated += ' -ctv q8_0';
  return migrated.trim();
}

export const DEFAULT_EMBEDDING_COMMAND =
  '"C:\\Trabalhos\\Modelos\\llama-prism-b10709-9a9394a-bin-win-cuda-13.3-x64\\llama-server.exe" ' +
  '-m "C:\\Trabalhos\\Modelos\\bge-m3-q8_0.gguf" --embedding --host 127.0.0.1 --port 8081 -ngl 99';

async function getValue(key: string): Promise<string | null> {
  return invoke<string | null>('get_config', { key });
}

async function setValue(key: string, value: string): Promise<void> {
  await invoke('set_config', { key, value });
}

export async function getChatConfig(): Promise<ChatLlamaConfig> {
  const [baseUrl, model] = await Promise.all([
    getValue(KEY_CHAT_BASE_URL),
    getValue(KEY_CHAT_MODEL),
  ]);

  return {
    baseUrl: baseUrl?.trim() || DEFAULT_CHAT_BASE_URL,
    model: model?.trim() || DEFAULT_CHAT_MODEL,
  };
}

export async function setChatConfig(config: ChatLlamaConfig): Promise<void> {
  await setValue(KEY_CHAT_BASE_URL, config.baseUrl.trim());
  await setValue(KEY_CHAT_MODEL, config.model.trim());
}

export async function getEmbeddingConfig(): Promise<EmbeddingLlamaConfig> {
  const [baseUrl, model] = await Promise.all([
    getValue(KEY_EMBEDDING_BASE_URL),
    getValue(KEY_EMBEDDING_MODEL),
  ]);

  return {
    baseUrl: baseUrl?.trim() || DEFAULT_EMBEDDING_BASE_URL,
    model: model?.trim() || DEFAULT_EMBEDDING_MODEL,
  };
}

export async function setEmbeddingConfig(config: EmbeddingLlamaConfig): Promise<void> {
  await setValue(KEY_EMBEDDING_BASE_URL, config.baseUrl.trim());
  await setValue(KEY_EMBEDDING_MODEL, config.model.trim());
}

/**
 * Comando de inicialização do llama-server de chat, como string editável.
 *
 * Comandos herdados de versões antigas (default antigo ou `--mmproj`) são
 * migrados na leitura e a versão migrada é gravada — uma única vez — para o
 * `config.json` não manter a configuração que estourava a VRAM.
 */
export async function getChatCommand(): Promise<string> {
  const value = await getValue(KEY_CHAT_COMMAND);
  const stored = value?.trim();
  if (!stored) {
    return DEFAULT_CHAT_COMMAND;
  }

  const migrated = migrateLegacyChatCommand(stored);
  if (migrated !== stored) {
    await setValue(KEY_CHAT_COMMAND, migrated);
  }
  return migrated;
}

export async function setChatCommand(command: string): Promise<void> {
  await setValue(KEY_CHAT_COMMAND, command.trim());
}

/** Comando de inicialização do llama-server de embeddings, como string editável. */
export async function getEmbeddingCommand(): Promise<string> {
  const value = await getValue(KEY_EMBEDDING_COMMAND);
  return value?.trim() || DEFAULT_EMBEDDING_COMMAND;
}

/**
 * Caminho do arquivo de configuração dos servidores MCP, criado pelo backend
 * na pasta de dados do app (ao lado do config.json).
 */
export async function getMcpConfigPath(): Promise<string> {
  return invoke<string>('ensure_mcp_config');
}

/**
 * Acrescenta `--mcp-servers-config` ao comando do llama-server de chat.
 *
 * Sem essa flag o servidor responde HTTP 403 em /tools e a consulta à web não
 * funciona. A flag é aplicada só na inicialização — o comando editável pelo
 * usuário continua limpo e não guarda caminho absoluto.
 */
export async function withMcpServersConfig(command: string): Promise<string> {
  if (command.includes('--mcp-servers-config')) {
    return command;
  }

  const path = await getMcpConfigPath();
  return `${command} --mcp-servers-config "${path}"`;
}

export async function setEmbeddingCommand(command: string): Promise<void> {
  await setValue(KEY_EMBEDDING_COMMAND, command.trim());
}