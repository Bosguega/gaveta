import { describe, expect, it } from 'vitest';
import type { ChatTool } from '@bosguega/llama-cpp';
import {
  MAX_SEARCH_RESULTS,
  MAX_TOOL_RESULT_CHARS,
  limitToolResultContent,
  restrictToolDefinitions,
} from './toolRestrictions';

/** Schema completo devolvido pelo llama-server, com tudo o que nao queremos expor. */
const fullSearchTool: ChatTool = {
  type: 'function',
  function: {
    name: 'tavily_tavily_search',
    description: 'Search the web',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'query' },
        search_depth: { type: 'string', enum: ['basic', 'advanced'] },
        topic: { type: 'string' },
        time_range: { type: 'string', enum: ['day', 'week', 'month', 'year'] },
        start_date: { type: 'string' },
        end_date: { type: 'string' },
        max_results: { type: 'number', default: 5, minimum: 5, maximum: 20 },
        include_raw_content: { type: 'boolean', default: false },
        include_images: { type: 'boolean' },
        include_image_descriptions: { type: 'boolean' },
        include_favicon: { type: 'boolean' },
        include_domains: { type: 'array' },
        exclude_domains: { type: 'array' },
        country: { type: 'string' },
        exact_match: { type: 'boolean' },
      },
      required: ['query'],
    },
  },
};

const extractTool: ChatTool = {
  type: 'function',
  function: {
    name: 'tavily_tavily_extract',
    description: 'Extract content from urls',
    parameters: { type: 'object', properties: { urls: { type: 'array' } } },
  },
};

function propertiesOf(tool: ChatTool): Record<string, unknown> {
  const params = tool.function.parameters as { properties?: Record<string, unknown> };
  return params.properties ?? {};
}

describe('restrictToolDefinitions', () => {
  it('mantem apenas os parametros permitidos na busca web', () => {
    const [restricted] = restrictToolDefinitions([fullSearchTool]);

    expect(Object.keys(propertiesOf(restricted))).toEqual([
      'query',
      'max_results',
      'time_range',
      'search_depth',
    ]);
    expect(propertiesOf(restricted)).not.toHaveProperty('include_raw_content');
    expect(propertiesOf(restricted)).not.toHaveProperty('include_domains');
    expect(propertiesOf(restricted)).not.toHaveProperty('country');
  });

  it('limita max_results e mantem query obrigatorio', () => {
    const [restricted] = restrictToolDefinitions([fullSearchTool]);

    expect(propertiesOf(restricted).max_results).toMatchObject({
      maximum: MAX_SEARCH_RESULTS,
      default: MAX_SEARCH_RESULTS,
    });
    expect((restricted.function.parameters as { required?: string[] }).required).toEqual(['query']);
  });

  it('nao altera as definicoes originais', () => {
    const original = structuredClone(fullSearchTool);
    restrictToolDefinitions([fullSearchTool]);

    expect(fullSearchTool).toEqual(original);
  });

  it('repassa intactas as demais ferramentas', () => {
    const tools = restrictToolDefinitions([fullSearchTool, extractTool]);

    expect(tools[1]).toBe(extractTool);
    expect(propertiesOf(tools[1])).toHaveProperty('urls');
  });

  it('produz um ChatTool valido com o nome preservado', () => {
    const [restricted] = restrictToolDefinitions([fullSearchTool]);

    expect(restricted.type).toBe('function');
    expect(restricted.function.name).toBe('tavily_tavily_search');
    expect(restricted.function.description).toBe('Search the web');
  });
});

describe('limitToolResultContent', () => {
  it('mantem intacto um resultado abaixo do limite', () => {
    const content = 'a'.repeat(MAX_TOOL_RESULT_CHARS);

    expect(limitToolResultContent(content)).toBe(content);
  });

  it('trunca um resultado acima do limite', () => {
    const content = 'a'.repeat(MAX_TOOL_RESULT_CHARS + 5000);

    const limited = limitToolResultContent(content);

    expect(limited.startsWith('a'.repeat(MAX_TOOL_RESULT_CHARS))).toBe(true);
    expect(limited).not.toBe(content);
    expect(limited).toContain('truncado pelo aplicativo');
  });

  it('informa quantos caracteres foram omitidos', () => {
    const limited = limitToolResultContent('b'.repeat(12000));

    expect(limited).toContain('4000 caracteres omitidos');
  });

  it('trata resultado ausente como conteudo vazio', () => {
    expect(limitToolResultContent(undefined)).toBe('');
  });
});