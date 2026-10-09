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
  /**
   * Aviso não-bloqueante (ex.: o servidor que já responde na porta não
   * corresponde ao comando configurado).
   */
  warning?: string;
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

/**
 * Extrai a porta de uma baseUrl tipo `http://127.0.0.1:8080`.
 * Indefinida quando a URL não tem porta explícita ou é inválida.
 */
export function portFromUrl(baseUrl: string): number | undefined {
  try {
    const port = new URL(baseUrl).port;
    return port ? Number(port) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Detecta quando o servidor que já responde na porta não corresponde ao comando
 * configurado (principalmente o modelo). Best-effort: compara o `-m` do comando
 * com os ids de `/v1/models` e devolve `undefined` quando a identificação não é
 * possível — nesse caso o reaproveitamento continua acontecendo como antes.
 */
async function detectRunningServerMismatch(
  baseUrl: string,
  command: string,
): Promise<string | undefined> {
  const modelArg = command.match(/-m\s+(?:"([^"]+)"|(\S+))/);
  const modelPath = modelArg?.[1] ?? modelArg?.[2];
  const fileName = modelPath?.split(/[\\/]/).pop()?.trim();
  if (!fileName) return undefined;

  try {
    const models = await createLlamaClient({ baseUrl }).listModels();
    if (models.length === 0) return undefined;

    const expected = fileName.toLowerCase();
    const matches = models.some((id) => {
      const current = id.toLowerCase();
      return current.includes(expected) || expected.includes(current);
    });
    if (matches) return undefined;

    return (
      `A porta responde com o modelo "${models[0]}", mas o comando configurado usa "${fileName}".\n` +
      'O servidor em execução não é o configurado — pare o processo antigo ' +
      '(janela de console ou Gerenciador de Tarefas) e inicie de novo para aplicar.'
    );
  } catch {
    // Identificação não confiável: não avisa e não bloqueia.
    return undefined;
  }
}

/** Encerra apenas processos iniciados pela própria aplicação. */
export async function stopServer(kind: LlamaServerKind, port?: number): Promise<boolean> {
  // O backend aguarda o processo sumir e a porta liberar antes de responder.
  return invoke<boolean>('stop_llama_server', port === undefined ? { kind } : { kind, port });
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
    const existing = await detectServerStatus(kind, url, embeddingModel);
    if (existing.status === 'executando') {
      const warning = await detectRunningServerMismatch(url, command);
      if (warning) {
        return { ...existing, warning };
      }
    }
    return existing;
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
  // Os processos são independentes e iniciados em paralelo: a falha de um não impede o outro.
  const settled = await Promise.allSettled(
    targets.map((target) =>
      startServer(
        target.kind,
        target.baseUrl,
        target.command,
        target.status,
        target.embeddingModel,
      ),
    ),
  );

  const results = {} as Record<LlamaServerKind, LaunchResult>;
  for (let i = 0; i < targets.length; i++) {
    const outcome = settled[i];
    if (outcome.status === 'fulfilled') {
      results[targets[i].kind] = outcome.value;
    } else {
      results[targets[i].kind] = {
        status: 'erro',
        error: outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason),
      };
    }
  }

  return results;
}
