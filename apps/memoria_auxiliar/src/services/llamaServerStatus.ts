/**
 * Estado de um servidor llama-server, determinado sempre pela comunicacao
 * real com a URL configurada — nunca apenas pelo fato de o processo existir.
 */
export type LlamaServerStatus = 'parado' | 'iniciando' | 'executando' | 'erro';

export const SERVER_STATUS_LABELS: Record<LlamaServerStatus, string> = {
  parado: 'Parado',
  iniciando: 'Iniciando...',
  executando: 'Em execução',
  erro: 'Erro',
};

export type LlamaServerKind = 'chat' | 'embedding';

/**
 * Só inicia um processo quando o servidor ainda não responde.
 * 'executando' e 'iniciando' nunca disparam um segundo processo.
 */
export function shouldLaunchServer(status: LlamaServerStatus): boolean {
  return status === 'parado' || status === 'erro';
}

/** Estado derivado de um health check. */
export function statusFromHealth(ok: boolean): LlamaServerStatus {
  return ok ? 'executando' : 'parado';
}

/**
 * No servidor de embeddings o health check não basta: um modelo com outra
 * dimensão responde 200 e produziria comparações inválidas. Nesse caso a
 * configuração é rejeitada, sem tocar em dados já gravados.
 */
export function statusFromEmbeddingValidation(ok: boolean): LlamaServerStatus {
  return ok ? 'executando' : 'erro';
}

/** Valida o comando configurado antes de tentar executá-lo. */
export function validateServerCommand(command: string): string | null {
  const trimmed = command.trim();
  if (!trimmed) {
    return 'Informe o comando de inicialização do servidor.';
  }
  if ((trimmed.match(/"/g)?.length ?? 0) % 2 !== 0) {
    return 'Aspas não balanceadas no comando.';
  }
  return null;
}
