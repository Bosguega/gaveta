/**
 * Protecoes aplicadas as ferramentas antes e depois do uso pelo modelo.
 *
 * Sao duas medidas complementares e independentes:
 *  1. `restrictToolDefinitions` limita a capacidade exposta ao modelo atraves do
 *     schema — evita que ele escolha parametros que geram respostas gigantes.
 *  2. `limitToolResultContent` limita fisicamente o que entra no contexto, ja
 *     que o llama-server nao valida os argumentos contra o schema.
 *
 * Sao funções puras e locais ao app: nao ha estado, configuracao ou abstracao
 * de gerenciador. `@bosguega/llama-cpp` permanece generico.
 */
import type { ChatTool } from '@bosguega/llama-cpp';

/** Nome da ferramenta de busca web, conforme exposto pelo servidor. */
const WEB_SEARCH_TOOL = 'tavily_tavily_search';

/**
 * Únicas ferramentas liberadas ao modelo. As demais que o servidor MCP
 * anuncia (map, crawl, research...) são descartadas: não são necessárias e
 * ampliariam o consumo de contexto e o custo da consulta.
 */
const ALLOWED_TOOLS = new Set([WEB_SEARCH_TOOL, 'tavily_tavily_extract']);

/** Parametros mantidos na busca web no primeiro fluxo. */
const SEARCH_ALLOWED_PARAMS = ['query', 'max_results', 'time_range', 'search_depth'] as const;

/** Teto de resultados por busca, para caber no contexto do chat. */
export const MAX_SEARCH_RESULTS = 3;

/** Teto de caracteres de um resultado de ferramenta no historico. */
export const MAX_TOOL_RESULT_CHARS = 8000;

const TRUNCATION_NOTICE = (omitted: number): string =>
  `\n\n[resultado truncado pelo aplicativo: ${omitted} caracteres omitidos]`;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Deriva novas definicoes de ferramentas com o schema da busca web reduzido ao
 * primeiro fluxo e descarta as ferramentas fora da lista permitida. As
 * definicoes originais nao sao mutadas.
 */
export function restrictToolDefinitions(tools: ChatTool[]): ChatTool[] {
  return tools
    .filter((tool) => ALLOWED_TOOLS.has(tool.function.name))
    .map((tool) =>
      tool.function.name === WEB_SEARCH_TOOL ? restrictSearchTool(tool) : tool,
    );
}

function restrictSearchTool(tool: ChatTool): ChatTool {
  const original = isRecord(tool.function.parameters) ? tool.function.parameters : {};
  const originalProperties = isRecord(original.properties) ? original.properties : {};

  const properties: Record<string, unknown> = {};
  for (const name of SEARCH_ALLOWED_PARAMS) {
    const property = originalProperties[name];
    if (isRecord(property)) {
      properties[name] = { ...property };
    }
  }

  // A busca nunca deve devolver mais que o teto, mesmo que o schema original
  // permita mais; o Bonsai respeita maximum, mas o parametro continua visivel.
  if (isRecord(properties.max_results)) {
    properties.max_results = {
      ...properties.max_results,
      maximum: MAX_SEARCH_RESULTS,
      default: MAX_SEARCH_RESULTS,
    };
  }

  return {
    type: 'function',
    function: {
      name: tool.function.name,
      description: tool.function.description,
      parameters: {
        ...original,
        properties,
        required: ['query'],
      },
    },
  };
}

/**
 * Limita o resultado de uma ferramenta antes de entrar no contexto. Resultados
 * dentro do limite sao mantidos intactos; acima do limite, sao cortados e
 * sinalizados. Nao ha resumo nem chamada adicional ao modelo.
 */
export function limitToolResultContent(
  content: string | undefined,
  maxChars: number = MAX_TOOL_RESULT_CHARS,
): string {
  const text = content ?? '';
  if (text.length <= maxChars) {
    return text;
  }
  return text.slice(0, maxChars) + TRUNCATION_NOTICE(text.length - maxChars);
}