import { describe, expect, it, vi } from 'vitest';
import type {
  ChatOptions,
  ChatResult,
  ChatTool,
  ChatToolCall,
  LlamaClient,
} from '@bosguega/llama-cpp';
import { MAX_TOOL_ROUNDS, askWithTools } from './toolChat';

const searchTool: ChatTool = {
  type: 'function',
  function: {
    name: 'tavily_tavily_search',
    description: 'Busca na web',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string' } },
      required: ['query'],
    },
  },
};

function toolCall(id: string, query: string): ChatToolCall {
  return {
    id,
    type: 'function',
    function: { name: 'tavily_tavily_search', arguments: JSON.stringify({ query }) },
  };
}

function mockClient(partial: Partial<LlamaClient>): LlamaClient {
  return {
    baseUrl: 'http://test',
    health: vi.fn(),
    chat: vi.fn(),
    embed: vi.fn(),
    listModels: vi.fn(),
    listTools: vi.fn(async () => []),
    callTool: vi.fn(),
    ...partial,
  } as unknown as LlamaClient;
}

/** Pergunta que autoriza explicitamente a consulta a web. */
const WEB_QUESTION = 'pesquise na web sobre o dolar';

/** Pergunta comum, sem pedido de consulta externa. */
const LOCAL_QUESTION = 'o que minhas notas dizem sobre o dolar';

describe('askWithTools (tool calling loop)', () => {
  it('retorna a resposta direta quando o LLM nao pede ferramentas', async () => {
    const chat = vi.fn(async (_opts: ChatOptions): Promise<ChatResult> => ({ content: 'ola mundo' }));
    const callTool = vi.fn();
    const client = mockClient({ chat, callTool });

    const outcome = await askWithTools('oi', client);

    expect(outcome).toEqual({
      answer: 'ola mundo',
      usedIds: [],
      chatCalls: 1,
      toolExecutions: 0,
    });
    expect(callTool).not.toHaveBeenCalled();
    // Sem pedido de web, as tools nem sao buscadas no servidor.
    expect(chat.mock.calls[0][0].tools).toBeUndefined();
  });

  it('executa uma ferramenta e usa o resultado na resposta final', async () => {
    const chat = vi
      .fn(async (_opts: ChatOptions): Promise<ChatResult> => ({ content: '' }))
      .mockResolvedValueOnce({ content: '', toolCalls: [toolCall('call_1', 'dolar')] })
      .mockResolvedValueOnce({ content: 'resposta final' });
    const callTool = vi.fn(async () => ({ plainTextResponse: 'R$ 5,17' }));
    const client = mockClient({ chat, callTool, listTools: vi.fn(async () => [searchTool]) });

    const outcome = await askWithTools(WEB_QUESTION, client);

    expect(outcome.answer).toBe('resposta final');
    expect(outcome.chatCalls).toBe(2);
    expect(outcome.toolExecutions).toBe(1);
    expect(callTool).toHaveBeenCalledWith('tavily_tavily_search', { query: 'dolar' });

    const secondRoundMessages = chat.mock.calls[1][0].messages;
    expect(secondRoundMessages.some((m) => m.role === 'assistant' && m.tool_calls?.length === 1)).toBe(true);
    expect(secondRoundMessages[secondRoundMessages.length - 1]).toEqual({
      role: 'tool',
      tool_call_id: 'call_1',
      content: 'R$ 5,17',
    });
  });

  it('executa todas as ferramentas de uma mesma rodada', async () => {
    const chat = vi
      .fn(async (_opts: ChatOptions): Promise<ChatResult> => ({ content: '' }))
      .mockResolvedValueOnce({ content: '', toolCalls: [toolCall('a', 'x'), toolCall('b', 'y')] })
      .mockResolvedValueOnce({ content: 'done' });
    const callTool = vi.fn(async () => ({ plainTextResponse: 'ok' }));
    const client = mockClient({ chat, callTool });

    const outcome = await askWithTools(WEB_QUESTION, client);

    expect(outcome.toolExecutions).toBe(2);
    expect(callTool).toHaveBeenNthCalledWith(1, 'tavily_tavily_search', { query: 'x' });
    expect(callTool).toHaveBeenNthCalledWith(2, 'tavily_tavily_search', { query: 'y' });
  });

  it('continua o loop por mais de uma rodada ate a resposta final', async () => {
    const chat = vi
      .fn(async (_opts: ChatOptions): Promise<ChatResult> => ({ content: '' }))
      .mockResolvedValueOnce({ content: '', toolCalls: [toolCall('c1', 'a')] })
      .mockResolvedValueOnce({ content: '', toolCalls: [toolCall('c2', 'b')] })
      .mockResolvedValueOnce({ content: 'final' });
    const callTool = vi.fn(async () => ({ plainTextResponse: 'ok' }));
    const client = mockClient({ chat, callTool });

    const outcome = await askWithTools(WEB_QUESTION, client);

    expect(outcome.answer).toBe('final');
    expect(outcome.chatCalls).toBe(3);
    expect(outcome.toolExecutions).toBe(2);
  });

  it('respeita o limite maximo de rodadas', async () => {
    const chat = vi.fn(
      async (_opts: ChatOptions): Promise<ChatResult> => ({
        content: '',
        toolCalls: [toolCall('c', 'x')],
      }),
    );
    const callTool = vi.fn(async () => ({ plainTextResponse: 'ok' }));
    const client = mockClient({ chat, callTool });

    await expect(askWithTools(WEB_QUESTION, client)).rejects.toThrow(/rodadas/i);
    expect(chat).toHaveBeenCalledTimes(MAX_TOOL_ROUNDS);
  });

  it('gera erro controlado quando os argumentos nao sao JSON valido', async () => {
    const chat = vi
      .fn(async (_opts: ChatOptions): Promise<ChatResult> => ({ content: '' }))
      .mockResolvedValueOnce({
        content: '',
        toolCalls: [
          {
            id: 'c1',
            type: 'function',
            function: { name: 'tavily_tavily_search', arguments: 'nao-e-json' },
          },
        ],
      });
    const callTool = vi.fn();
    const client = mockClient({ chat, callTool });

    await expect(askWithTools(WEB_QUESTION, client)).rejects.toThrow(/JSON/i);
    expect(callTool).not.toHaveBeenCalled();
  });

  it('propaga o erro quando callTool falha', async () => {
    const chat = vi
      .fn(async (_opts: ChatOptions): Promise<ChatResult> => ({ content: '' }))
      .mockResolvedValueOnce({ content: '', toolCalls: [toolCall('c1', 'x')] });
    const callTool = vi.fn(async () => {
      throw new Error('tool indisponivel');
    });
    const client = mockClient({ chat, callTool });

    await expect(askWithTools(WEB_QUESTION, client)).rejects.toThrow('tool indisponivel');
  });
it('trunca o resultado da busca ao entrar no historico, preservando tool_call_id', async () => {
    const chat = vi
      .fn(async (_opts: ChatOptions): Promise<ChatResult> => ({ content: '' }))
      .mockResolvedValueOnce({ content: '', toolCalls: [toolCall('call_x', 'dolar')] })
      .mockResolvedValueOnce({ content: 'final' });
    const callTool = vi.fn(async () => ({ plainTextResponse: 'z'.repeat(20000) }));
    const client = mockClient({ chat, callTool, listTools: vi.fn(async () => [searchTool]) });

    await askWithTools(WEB_QUESTION, client);

    const messages = chat.mock.calls[1][0].messages;
    expect(messages[messages.length - 1]).toMatchObject({
      role: 'tool',
      tool_call_id: 'call_x',
    });
    expect(messages[messages.length - 1].content).toContain('truncado pelo aplicativo');
  });

  it('aplica o mesmo limite ao resultado do extract', async () => {
    const chat = vi
      .fn(async (_opts: ChatOptions): Promise<ChatResult> => ({ content: '' }))
      .mockResolvedValueOnce({
        content: '',
        toolCalls: [
          {
            id: 'call_e',
            type: 'function',
            function: {
              name: 'tavily_tavily_extract',
              arguments: JSON.stringify({ urls: ['https://exemplo.com'] }),
            },
          },
        ],
      })
      .mockResolvedValueOnce({ content: 'final' });
    const callTool = vi.fn(async () => ({ plainTextResponse: 'y'.repeat(9000) }));
    const client = mockClient({ chat, callTool });

    await askWithTools(WEB_QUESTION, client);

    const messages = chat.mock.calls[1][0].messages;
    const toolMessage = messages[messages.length - 1];
    expect(toolMessage.role).toBe('tool');
    expect(toolMessage.content).toContain('truncado pelo aplicativo');
  });

  it('repassa ao chat o schema da busca restrito', async () => {
    const chat = vi
      .fn(async (_opts: ChatOptions): Promise<ChatResult> => ({ content: 'ok' }))
      .mockResolvedValueOnce({ content: 'ok' });
    const exposedTool: ChatTool = {
      type: 'function',
      function: {
        name: 'tavily_tavily_search',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string' },
            include_raw_content: { type: 'boolean' },
            max_results: { type: 'number', maximum: 20 },
          },
          required: ['query'],
        },
      },
    };
    const client = mockClient({ chat, listTools: vi.fn(async () => [exposedTool]) });

    await askWithTools(WEB_QUESTION, client);

    const properties = (chat.mock.calls[0][0].tools as ChatTool[])[0].function
      .parameters as { properties: Record<string, unknown> };
    expect(Object.keys(properties.properties)).toEqual(['query', 'max_results']);
    expect(properties.properties.max_results).toMatchObject({ maximum: 3 });
  });

  it('nao passa tools quando a pergunta nao pede consulta externa', async () => {
    const chat = vi.fn(async (_opts: ChatOptions): Promise<ChatResult> => ({ content: 'ok' }));
    const client = mockClient({ chat, listTools: vi.fn(async () => [searchTool]) });

    const outcome = await askWithTools(LOCAL_QUESTION, client);

    expect(outcome.answer).toBe('ok');
    expect(chat.mock.calls[0][0].tools).toBeUndefined();
  });

  it('nao lista nem executa ferramentas quando a web nao esta autorizada', async () => {
    const chat = vi
      .fn(async (_opts: ChatOptions): Promise<ChatResult> => ({ content: 'resposta local' }))
      .mockResolvedValueOnce({
        content: '',
        toolCalls: [toolCall('c1', 'dolar')],
      })
      .mockResolvedValueOnce({ content: 'resposta local' });
    const listTools = vi.fn(async () => [searchTool]);
    const callTool = vi.fn(async () => ({ plainTextResponse: 'R$ 5,17' }));
    const client = mockClient({ chat, listTools, callTool });

    const outcome = await askWithTools(LOCAL_QUESTION, client);

    expect(listTools).not.toHaveBeenCalled();
    expect(callTool).not.toHaveBeenCalled();
    expect(outcome.toolExecutions).toBe(0);
  });

  it('passa as tools ao chat quando a web esta autorizada', async () => {
    const chat = vi.fn(async (_opts: ChatOptions): Promise<ChatResult> => ({ content: 'ok' }));
    const listTools = vi.fn(async () => [searchTool]);
    const client = mockClient({ chat, listTools });

    await askWithTools(WEB_QUESTION, client);

    expect(listTools).toHaveBeenCalledTimes(1);
    expect(chat.mock.calls[0][0].tools).toEqual([searchTool]);
  });

  it('mantem o loop de tool calling funcionando com a web autorizada', async () => {
    const chat = vi
      .fn(async (_opts: ChatOptions): Promise<ChatResult> => ({ content: '' }))
      .mockResolvedValueOnce({ content: '', toolCalls: [toolCall('call_1', 'dolar')] })
      .mockResolvedValueOnce({ content: 'resposta final' });
    const callTool = vi.fn(async () => ({ plainTextResponse: 'R$ 5,17' }));
    const client = mockClient({ chat, callTool, listTools: vi.fn(async () => [searchTool]) });

    const outcome = await askWithTools(WEB_QUESTION, client);

    expect(outcome).toEqual({
      answer: 'resposta final',
      usedIds: [],
      chatCalls: 2,
      toolExecutions: 1,
    });
    expect(callTool).toHaveBeenCalledWith('tavily_tavily_search', { query: 'dolar' });
    // A segunda rodada continua recebendo as mesmas tools.
    expect(chat.mock.calls[1][0].tools).toEqual([searchTool]);
  });

  it('fornece o contexto RAG ao modelo no caminho com web', async () => {
    const chat = vi.fn(async (_opts: ChatOptions): Promise<ChatResult> => ({ content: 'ok' }));
    const client = mockClient({ chat, listTools: vi.fn(async () => [searchTool]) });

    await askWithTools(WEB_QUESTION, client, {
      notesContext: '[MEMORY_ID: 7]\nnota sobre pglite',
    });

    const [system, user] = chat.mock.calls[0][0].messages;
    expect(system.content).toContain('ferramentas web disponiveis');
    expect(user.content).toContain('[MEMORY_ID: 7]');
    expect(user.content).toContain('nota sobre pglite');
    expect(user.content).toContain(WEB_QUESTION);
  });

  it('extrai USED_IDS da resposta final no caminho com web', async () => {
    const chat = vi.fn(async (_opts: ChatOptions): Promise<ChatResult> => ({
      content: 'Resposta usando memoria e web.\n\nUSED_IDS: [7, 12]',
    }));
    const client = mockClient({ chat, listTools: vi.fn(async () => [searchTool]) });

    const outcome = await askWithTools(WEB_QUESTION, client, {
      notesContext: '[MEMORY_ID: 7]\nnota\n[MEMORY_ID: 12]\noutra nota',
    });

    expect(outcome.answer).toBe('Resposta usando memoria e web.');
    expect(outcome.usedIds).toEqual([7, 12]);
  });

  it('devolve usedIds vazio quando a resposta usa somente a web', async () => {
    const chat = vi.fn(async (_opts: ChatOptions): Promise<ChatResult> => ({
      content: 'Resposta vinda da web.',
    }));
    const client = mockClient({ chat, listTools: vi.fn(async () => [searchTool]) });

    const outcome = await askWithTools(WEB_QUESTION, client, { notesContext: '' });

    expect(outcome.usedIds).toEqual([]);
    expect(outcome.answer).toBe('Resposta vinda da web.');
  });
});
