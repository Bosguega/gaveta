/**
 * AiApiError — Erro tipado para falhas HTTP nas APIs de IA.
 *
 * Permite que o orquestrador de retry (ai/index.ts) distinga erros de cliente
 * (4xx — não devem ter retry) de erros de servidor (5xx — podem ter retry)
 * sem recorrer a comparação frágil de strings de mensagem.
 */
export class AiApiError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = "AiApiError";
    this.statusCode = statusCode;
  }

  /** Erros de cliente (4xx) que não devem disparar retry. */
  isClientError(): boolean {
    return this.statusCode >= 400 && this.statusCode < 500 && this.statusCode !== 429;
  }
}
