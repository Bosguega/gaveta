/**
 * Spike isolado de tool calling.
 *
 * Executa o ciclo:
 *   chat -> tool_calls -> callTool -> role:"tool" -> chat ... -> resposta final
 *
 * Não é a arquitetura definitiva: não há seleção de tools, regra de "quando
 * usar web", UI nem estado global. O cliente é injetado para permitir testes
 * com mocks e evitar acoplamento à configuração de servidores do app.
 */
import type { ChatMessage, ChatTool, LlamaClient } from '@bosguega/llama-cpp';

/** Limite de rodadas de ferramentas para evitar loop infinito. */
export const MAX_TOOL_ROUNDS = 5;

const DEFAULT_SYSTEM_PROMPT =
  'Voce e um assistente. Use as ferramentas disponiveis quando precisar de informacao externa ou atualizada.';

export interface ToolChatOutcome {
  /** Resposta final do modelo (sem tool calls pendentes). */
  answer: string;
  /** Quantidade de chamadas a chat() realizadas. */
  chatCalls: number;
  /** Quantidade de ferramentas efetivamente executadas. */
  toolExecutions: number;
}

export interface ToolChatOptions {
  maxRounds?: number;
  systemPrompt?: string;
}

/**
 * Converte a string de argumentos devolvida pelo modelo em objeto.
 * Argumentos ausentes ou fora do formato de objeto JSON são tratados como erro.
 */
function parseToolArguments(raw: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Argumentos de ferramenta nao sao JSON valido: ${raw}`);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Os argumentos de ferramenta devem ser um objeto JSON.');
  }
  return parsed as Record<string, unknown>;
}

export async function askWithTools(
  question: string,
  client: LlamaClient,
  options?: ToolChatOptions,
): Promise<ToolChatOutcome> {
  const maxRounds = options?.maxRounds ?? MAX_TOOL_ROUNDS;

  // As definicoes vem do proprio servidor; nada e hardcoded aqui.
  const tools: ChatTool[] = await client.listTools();

  const messages: ChatMessage[] = [
    { role: 'system', content: options?.systemPrompt ?? DEFAULT_SYSTEM_PROMPT },
    { role: 'user', content: question },
  ];

  let toolExecutions = 0;

  for (let round = 1; round <= maxRounds; round += 1) {
    const result = await client.chat({ messages, tools });

    const toolCalls = result.toolCalls;
    if (!toolCalls || toolCalls.length === 0) {
      return { answer: result.content, chatCalls: round, toolExecutions };
    }

    // Reenvia a mensagem do assistant com as tool calls para manter o historico
    // coerente (a resposta do modelo vem com content vazio nesse caso).
    messages.push({
      role: 'assistant',
      content: result.content.trim().length > 0 ? result.content : null,
      tool_calls: toolCalls,
    });

    for (const call of toolCalls) {
      const params = parseToolArguments(call.function.arguments);
      const toolResult = await client.callTool(call.function.name, params);
      toolExecutions += 1;
      messages.push({
        role: 'tool',
        tool_call_id: call.id,
        content: toolResult.plainTextResponse ?? '',
      });
    }
  }

  throw new Error(
    `Limite de ${maxRounds} rodadas de ferramentas excedido sem resposta final.`,
  );
}
