export type ChatRole = 'system' | 'user' | 'assistant';

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

export interface ChatMessage {
  role: ChatRole;
  content: string | ChatContentPart[];
}

export interface ChatOptions {
  model?: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  enableThinking?: boolean;
  signal?: AbortSignal;
}

export interface ChatResult {
  content: string;
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
}

export interface LlamaClient {
  readonly baseUrl: string;
  health(options?: HealthOptions): Promise<boolean>;
  chat(options: ChatOptions): Promise<ChatResult>;
  embed(options: EmbeddingOptions): Promise<EmbedResult>;
  listModels(options?: ListModelsOptions): Promise<string[]>;
}
