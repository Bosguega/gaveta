export interface Note {
  id: number;
  content: string;
  embedding: string;
  created_at: string;
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

export interface Stats {
  streak: number;
  lastUse: string | null;
}

/** Tipos de segmento para conteudo interativo (links, caminhos, texto) */
export type InteractiveSegmentType = 'text' | 'url' | 'path';

export interface InteractiveSegment {
  type: InteractiveSegmentType;
  value: string;
}
