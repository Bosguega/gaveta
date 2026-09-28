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

export interface HealthOptions {
  signal?: AbortSignal;
}

export interface LlamaClientOptions {
  baseUrl?: string;
  defaultModel?: string;
  timeoutMs?: number;
  healthTimeoutMs?: number;
}

export interface LlamaClient {
  readonly baseUrl: string;
  health(options?: HealthOptions): Promise<boolean>;
  chat(options: ChatOptions): Promise<ChatResult>;
}
