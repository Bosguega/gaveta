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