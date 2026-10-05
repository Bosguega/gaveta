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
import type { ChatMessage, LlamaClient } from '@bosguega/llama-cpp';
import { isWebSearchRequested } from '../utils/webIntent';
import { parseUsedIds } from './llmService';
import { limitToolResultContent, restrictToolDefinitions } from './toolRestrictions';

/** Limite de rodadas de ferramentas para evitar loop infinito. */
export const MAX_TOOL_ROUNDS = 5;

export interface ToolChatOutcome {
  /** Resposta final do modelo (sem tool calls pendentes). */
  answer: string;
  /** IDs das memorias realmente utilizadas, lidos da linha USED_IDS. */
  usedIds: number[];
  /** Quantidade de chamadas a chat() realizadas. */
  chatCalls: number;
  /** Quantidade de ferramentas efetivamente executadas. */
  toolExecutions: number;
}

export interface ToolChatOptions {
  maxRounds?: number;
  systemPrompt?: string;
  /**
   * Contexto RAG ja preparado (`buildNotesContext`). Quando presente, entra no
   * prompt do modelo e os IDs citados em USED_IDS sao devolvidos em `usedIds`.
   */
  notesContext?: string;
}

/**
 * Prompt do caminho com web: combina as memorias com o resultado das ferramentas.
 * Difere do prompt do caminho local apenas ao permitir fonte externa — as
 * instrucoes de citar USED_IDS e de nao inventar informacoes permanecem.
 */
const WEB_SYSTEM_PROMPT =
  'Voce e uma memoria auxiliar pessoal.\n' +
  '\n' +
  'Voce pode responder usando as memorias fornecidas e, quando precisar de informacao externa ou atualizada, as ferramentas web disponiveis.\n' +
  '\n' +
  'REGRAS IMPORTANTES:\n' +
  '- Nao invente informacoes.\n' +
  '- Use as ferramentas quando a pergunta depender de dados externos ou atuais.\n' +
  '- Nem toda memoria enviada precisa ser usada.\n' +
  '- Use apenas as memorias realmente relevantes.\n' +
  '\n' +
  'SOBRE PESQUISAR NA WEB:\n' +
  '- Faca poucas pesquisas e escolha consultas bem direcionadas ao que a pergunta pede.\n' +
  '- Nao repita buscas nem pesquise de novo um tema que os resultados anteriores ja cobriram o suficiente.\n' +
  '- Assim que tiver informacao suficiente para responder, pare de pesquisar e responda.\n' +
  '- Nao tente fazer uma pesquisa exaustiva quando ela nao for necessaria para responder ao usuario.';

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

/**
 * Monta o resultado final, extraindo os IDs de memoria citados pelo modelo.
 * Sem contexto de notas, a resposta pode citar apenas a web: `usedIds` fica vazio.
 */
function finish(answer: string, round: number, toolExecutions: number): ToolChatOutcome {
  const parsed = parseUsedIds(answer);
  return {
    answer: parsed.answer,
    usedIds: parsed.usedIds,
    chatCalls: round,
    toolExecutions,
  };
}

export async function askWithTools(
  question: string,
  client: LlamaClient,
  options?: ToolChatOptions,
): Promise<ToolChatOutcome> {
  const maxRounds = options?.maxRounds ?? MAX_TOOL_ROUNDS;

  // A web e uma capacidade adicional: as ferramentas so sao oferecidas quando o
  // usuario pede explicitamente uma consulta externa. Sem esse pedido, o chat
  // segue igual ao de sempre, sem `tools`, baseado nas notas (RAG).
  const webAllowed = isWebSearchRequested(question);
  // As definicoes vem do proprio servidor; nada e hardcoded aqui. O schema e
  // reduzido antes de chegar ao modelo para controlar a capacidade exposta.
  const tools = webAllowed ? restrictToolDefinitions(await client.listTools()) : undefined;

  const messages: ChatMessage[] = [
    { role: 'system', content: options?.systemPrompt ?? WEB_SYSTEM_PROMPT },
  ];

  // O contexto RAG entra antes da pergunta, no mesmo formato do caminho local
  // ([MEMORY_ID: N] + conteudo), para que o modelo possa citar USED_IDS.
  const notesContext = options?.notesContext?.trim();
  messages.push({
    role: 'user',
    content: notesContext ? `MEMORIAS:\n${notesContext}\n\nPERGUNTA:\n${question}` : question,
  });

  let toolExecutions = 0;

  for (let round = 1; round <= maxRounds; round += 1) {
    const result = await client.chat({ messages, tools });

    const toolCalls = result.toolCalls;
    if (!toolCalls || toolCalls.length === 0) {
      return finish(result.content, round, toolExecutions);
    }

    // Sem ferramentas autorizadas, nenhuma chamada e executada: o usuario nao
    // pediu consulta externa, entao o resultado vao-a como esta.
    if (!tools) {
      return finish(result.content, round, toolExecutions);
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
        content: limitToolResultContent(toolResult.plainTextResponse),
      });
    }
  }

  throw new Error(
    `Limite de ${maxRounds} rodadas de ferramentas excedido sem resposta final.`,
  );
}
