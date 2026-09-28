/**
 * Gerenciamento dos servidores locais llama-server.
 *
 * O app apenas configura, inicia e verifica. Não é um supervisor: cada
 * processo roda por conta própria, em janela de console própria, e continua
 * ativo depois que o comando de inicialização termina.
 *
 * O status sempre vem da comunicação real com a URL configurada. Um processo
 * criado cujo modelo falha ao carregar nunca aparece como "Em execução".
 */
import { invoke } from '@tauri-apps/api/core';
import { createLlamaClient, normalizeBaseUrl } from '@bosguega/llama-cpp';
import { testEmbeddingConnection } from './embeddingConnection';
import {
  shouldLaunchServer,
  statusFromEmbeddingValidation,
  statusFromHealth,
  validateServerCommand,
  type LlamaServerKind,
  type LlamaServerStatus,
} from './llamaServerStatus';

const STARTUP_TIMEOUT_MS = 180_000;
const POLL_INTERVAL_MS = 1_500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface LaunchResult {
  status: LlamaServerStatus;
  error?: string;
}

/** Health check real contra a URL configurada. */
export async function probeServer(baseUrl: string): Promise<boolean> {
  const client = createLlamaClient({ baseUrl, healthTimeoutMs: 3_000 });
  try {
    return await client.health();
  } catch {
    return false;
  }
}

/** O app iniciou esse processo e por isso pode encerrá-lo. */
export async function isServerOwned(kind: LlamaServerKind): Promise<boolean> {
  return invoke<boolean>('is_llama_server_owned', { kind });
}

/** Encerra apenas processos iniciados pela própria aplicação. */
export async function stopServer(kind: LlamaServerKind): Promise<boolean> {
  return invoke<boolean>('stop_llama_server', { kind });
}

async function launchProcess(kind: LlamaServerKind, command: string): Promise<string | null> {
  const invalid = validateServerCommand(command);
  if (invalid) {
    return invalid;
  }

  try {
    await invoke<boolean>('start_llama_server', { kind, command: command.trim() });
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
}

/**
 * Aguarda o servidor responder na URL configurada.
 * 'Em execução' só é reportado após uma resposta bem-sucedida.
 */
async function waitUntilHealthy(baseUrl: string): Promise<boolean> {
  const deadline = Date.now() + STARTUP_TIMEOUT_MS;

  while (Date.now() < deadline) {
    if (await probeServer(baseUrl)) {
      return true;
    }
    await sleep(POLL_INTERVAL_MS);
  }

  return false;
}

/**
 * Estado atual do servidor, sem iniciar nada.
 * Para embeddings, um servidor que responde mas com a dimensão errada é
 * rejeitado — nem "Em execução".
 */
export async function detectServerStatus(
  kind: LlamaServerKind,
  baseUrl: string,
  embeddingModel: string,
): Promise<LaunchResult> {
  const url = normalizeBaseUrl(baseUrl);

  if (!(await probeServer(url))) {
    return { status: 'parado' };
  }

  if (kind === 'embedding') {
    return validateEmbeddingServer(url, embeddingModel);
  }

  return { status: statusFromHealth(true) };
}

async function validateEmbeddingServer(baseUrl: string, model: string): Promise<LaunchResult> {
  const result = await testEmbeddingConnection(baseUrl, model);
  return {
    status: statusFromEmbeddingValidation(result.success),
    error: result.success ? undefined : result.error,
  };
}

/**
 * Inicia o servidor se — e somente se — ele ainda não estiver respondendo.
 *
 * Servidores que já estão de pé são preservados: nenhum processo duplicado é
 * criado e nenhum servidor funcional é reiniciado.
 */
export async function startServer(
  kind: LlamaServerKind,
  baseUrl: string,
  command: string,
  currentStatus: LlamaServerStatus,
  embeddingModel: string,
): Promise<LaunchResult> {
  const url = normalizeBaseUrl(baseUrl);

  if (!shouldLaunchServer(currentStatus)) {
    return { status: currentStatus };
  }

  if (await probeServer(url)) {
    // Outro processo já está atendendo esta URL: não duplicamos.
    return detectServerStatus(kind, url, embeddingModel);
  }

  const launchError = await launchProcess(kind, command);
  if (launchError) {
    return { status: 'erro', error: launchError };
  }

  if (!(await waitUntilHealthy(url))) {
    return {
      status: 'erro',
      error: `O processo foi criado, mas o servidor não respondeu em ${url}. Veja a janela de console para o erro.`,
    };
  }

  if (kind === 'embedding') {
    return validateEmbeddingServer(url, embeddingModel);
  }

  return { status: statusFromHealth(true) };
}

/** Inicia apenas os servidores que estiverem parados; os demais são preservados. */
export async function startServers(
  targets: Array<{
    kind: LlamaServerKind;
    baseUrl: string;
    command: string;
    status: LlamaServerStatus;
    embeddingModel: string;
  }>,
): Promise<Record<LlamaServerKind, LaunchResult>> {
  const results = {} as Record<LlamaServerKind, LaunchResult>;

  // Os dois processos são independentes: a falha de um não impede o outro.
  for (const target of targets) {
    results[target.kind] = await startServer(
      target.kind,
      target.baseUrl,
      target.command,
      target.status,
      target.embeddingModel,
    );
  }

  return results;
}
