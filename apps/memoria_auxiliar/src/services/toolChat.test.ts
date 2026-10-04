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

describe('askWithTools (tool calling loop)', () => {
  it('retorna a resposta direta quando o LLM nao pede ferramentas', async () => {
    const chat = vi.fn(async (_opts: ChatOptions): Promise<ChatResult> => ({ content: 'ola mundo' }));
    const callTool = vi.fn();
    const client = mockClient({ chat, callTool });

    const outcome = await askWithTools('oi', client);

    expect(outcome).toEqual({ answer: 'ola mundo', chatCalls: 1, toolExecutions: 0 });
    expect(callTool).not.toHaveBeenCalled();
    // As tools do servidor sao repassadas ao chat mesmo quando vazias.
    expect(chat.mock.calls[0][0].tools).toEqual([]);
  });

  it('executa uma ferramenta e usa o resultado na resposta final', async () => {
    const chat = vi
      .fn(async (_opts: ChatOptions): Promise<ChatResult> => ({ content: '' }))
      .mockResolvedValueOnce({ content: '', toolCalls: [toolCall('call_1', 'dolar')] })
      .mockResolvedValueOnce({ content: 'resposta final' });
    const callTool = vi.fn(async () => ({ plainTextResponse: 'R$ 5,17' }));
    const client = mockClient({ chat, callTool, listTools: vi.fn(async () => [searchTool]) });

    const outcome = await askWithTools('qual a cotacao?', client);

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

    const outcome = await askWithTools('q', client);

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

    const outcome = await askWithTools('q', client);

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

    await expect(askWithTools('q', client)).rejects.toThrow(/rodadas/i);
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

    await expect(askWithTools('q', client)).rejects.toThrow(/JSON/i);
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

    await expect(askWithTools('q', client)).rejects.toThrow('tool indisponivel');
  });
});
