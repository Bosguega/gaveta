export type ChatRole = 'system' | 'user' | 'assistant' | 'tool';

export interface ChatTextContentPart {
  type: 'text';
  text: string;
}

export interface ChatImageUrlContentPart {
  type: 'image_url';
  image_url: {
    url: string;
  };
}

export type ChatContentPart = ChatTextContentPart | ChatImageUrlContentPart;

/**
 * Definição de uma ferramenta exposta ao modelo (schema no formato OpenAI).
 * Os nomes vêm do servidor; ex.: `tavily_tavily_search`.
 */
export interface ChatToolFunction {
  name: string;
  description?: string;
  parameters?: Record<string, unknown>;
}

export interface ChatTool {
  type: 'function';
  function: ChatToolFunction;
}

/**
 * `tool_choice` no formato OpenAI: as formas curtas aceitas pelo llama-server
 * ou a escolha explícita de uma função.
 */
export type ChatToolChoice =
  | 'none'
  | 'auto'
  | 'required'
  | { type: 'function'; function: { name: string } };

/**
 * Chamada de ferramenta devolvida pelo modelo. `arguments` é a string JSON
 * recebida do servidor — o parsing é responsabilidade do chamador.
 */
export interface ChatToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ChatMessage {
  role: ChatRole;
  /** `null` é aceito para mensagens do assistant que só carregam `tool_calls`. */
  content: string | ChatContentPart[] | null;
  /** Presente em mensagens do assistant que pedem a execução de ferramentas. */
  tool_calls?: ChatToolCall[];
  /** Presente em mensagens de role 'tool', ligando o resultado à chamada. */
  tool_call_id?: string;
}

export interface ChatOptions {
  model?: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  enableThinking?: boolean;
  /** Ferramentas disponíveis ao modelo. Omitido, o comportamento é o atual. */
  tools?: ChatTool[];
  /** Estratégia de escolha de ferramenta, repassada como `tool_choice`. */
  toolChoice?: ChatToolChoice;
  signal?: AbortSignal;
}

/** Contagem de tokens devolvida pelo servidor. */
export interface ChatUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

/** Tempos de processamento devolvidos pelo llama.cpp. */
export interface ChatTimings {
  promptMs?: number;
  predictedMs?: number;
  predictedPerSecond?: number;
}

export interface ChatResult {
  /**
   * Texto do modelo. Pode vir vazio quando a resposta é uma chamada de
   * ferramenta — nesse caso `toolCalls` estará preenchido.
   */
  content: string;
  /** Chamadas de ferramenta pedidas pelo modelo, quando houver. */
  toolCalls?: ChatToolCall[];
  /** `finish_reason` do servidor (ex.: 'stop', 'length', 'tool_calls'). */
  finishReason?: string;
  /** Métricas do servidor, quando disponíveis. */
  usage?: ChatUsage;
  timings?: ChatTimings;
  /** Tempo total medido no cliente, em ms (inclui rede). */
  elapsedMs?: number;
}

export interface ListToolsOptions {
  signal?: AbortSignal;
}

export interface CallToolOptions {
  signal?: AbortSignal;
}

export interface ToolCallResult {
  /**
   * Texto plano devolvido pelo llama-server em `plain_text_response`,
   * normalizado para camelCase como os demais campos deste package.
   */
  plainTextResponse?: string;
}

export interface EmbeddingOptions {
  model?: string;
  input: string | string[];
  signal?: AbortSignal;
}

export interface EmbedResult {
  /** Um embedding por entrada, na mesma ordem de `input`. */
  embeddings: number[][];
}

export interface ListModelsOptions {
  signal?: AbortSignal;
}

export interface HealthOptions {
  signal?: AbortSignal;
}

export interface LlamaClientOptions {
  baseUrl?: string;
  defaultModel?: string;
  timeoutMs?: number;
  healthTimeoutMs?: number;
  embedTimeoutMs?: number;
  modelsTimeoutMs?: number;
  toolsTimeoutMs?: number;
}

export interface LlamaClient {
  readonly baseUrl: string;
  health(options?: HealthOptions): Promise<boolean>;
  chat(options: ChatOptions): Promise<ChatResult>;
  embed(options: EmbeddingOptions): Promise<EmbedResult>;
  listModels(options?: ListModelsOptions): Promise<string[]>;
  listTools(options?: ListToolsOptions): Promise<ChatTool[]>;
  callTool(
    tool: string,
    params?: Record<string, unknown>,
    options?: CallToolOptions
  ): Promise<ToolCallResult>;
}
