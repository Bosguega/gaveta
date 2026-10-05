export type AppTheme = 'dark' | 'oled' | 'cyberpunk' | 'emerald' | 'light';

export interface Note {
  id: number;
  content: string;
  embedding: string;
  parsedEmbedding?: number[];
  tags?: string;
  pinned?: boolean;
  reminder_at?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface SearchResult {
  note: Note;
  score: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  /** Memorias efetivamente utilizadas pela LLM */
  usedSources?: SearchResult[];
  /** Memorias recuperadas pela busca vetorial (para debug) */
  retrievedSources?: SearchResult[];
  /** IDs das memorias utilizadas, retornados pela LLM */
  usedIds?: number[];
  /** Métricas da resposta. Ausente em conversas antigas: o rodapé não aparece. */
  metrics?: ChatMetrics;
}

/**
 * Métricas de uma resposta do assistente.
 *
 * Tokens e tempos vêm do llama.cpp quando ele os informa; o tempo total é
 * medido no cliente (inclui rede e as rodadas de ferramentas).
 */
export interface ChatMetrics {
  /** Tokens gerados na resposta. */
  outputTokens?: number;
  /** Tokens enviados ao modelo. */
  inputTokens?: number;
  /** Tokens de entrada + saída. */
  totalTokens?: number;
  /** Velocidade efetiva de geração (tok/s). */
  tokensPerSecond?: number;
  /** Tempo total da requisição, medido no cliente (ms). */
  totalMs?: number;
  /** Tempo até o primeiro token (ms). Sem streaming, equivale ao total. */
  ttftMs?: number;
  /** Tempo dedicado à geração dos tokens (ms). */
  generationMs?: number;
  /** Notas do RAG realmente usadas na resposta. */
  notesUsed?: number;
  /** Chamadas de ferramentas executadas (MCP). */
  toolCalls?: number;
}

export interface ChatSession {
  id: number;
  title: string;
  messages: string;
  created_at: string;
  updated_at: string;
}

export interface Stats {
  streak: number;
  lastUse: string | null;
}

export interface ToastNotification {
  show: boolean;
  message: string;
  type: 'success' | 'info' | 'error';
}

export interface ClipboardAnalysis {
  type: 'code' | 'url' | 'path' | 'text';
  original: string;
  formatted: string;
  suggestedTags: string[];
}

/** Tipos de segmento para conteudo interativo (links, caminhos, texto) */
export type InteractiveSegmentType = 'text' | 'url' | 'path';

export interface InteractiveSegment {
  type: InteractiveSegmentType;
  value: string;
}

/** Configuração do llama-server responsável pelo chat (geração de texto). */
export interface ChatLlamaConfig {
  baseUrl: string;
  model: string;
}

/** Configuração do llama-server responsável pelos embeddings. */
export interface EmbeddingLlamaConfig {
  baseUrl: string;
  model: string;
}

/** Perfil lógico do pipeline de embeddings gravado no banco. */
export interface EmbeddingProfile {
  modelName: string;
  dimensions: number;
  normalization: 'l2';
  version: string;
}

/** Códigos de erro canonicos conhecidos. */
export type ApiErrorCode =
  | 'INVALID_API_KEY'
  | 'RATE_LIMIT_EXCEEDED'
  | 'NETWORK_ERROR'
  | 'SERVICE_UNAVAILABLE'
  | 'SERVER_ERROR'
  | 'TIMEOUT'
  | 'INVALID_RESPONSE'
  | 'INVALID_RESPONSE_FORMAT'
  | 'UNKNOWN_ERROR';

/** Estrutura padronizada de erro retornada por APIs de IA. */
export interface ApiErrorLike {
  code: ApiErrorCode;
  message: string;
  status_code?: number;
}