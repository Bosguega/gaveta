/**
 * Reindexação de embeddings das notas.
 *
 * Objetivo: recuperar notas que ficaram sem vetor válido (ex.: servidor de
 * embeddings indisponível no momento da criação) sem tocar nas notas que já
 * possuem embedding válido.
 *
 * Regras de segurança:
 * - Notas com embedding válido são ignoradas (nenhum custo de rede, nada é sobrescrito).
 * - Falhas de rede/parâmetros não apagam embeddings existentes: a nota só é
 *   persistida depois que um embedding novo foi obtido com sucesso.
 */
import { updateNote } from './databaseService';
import { getEmbedding } from './embeddingService';
import { hasValidEmbedding } from './similarityService';
import type { Note } from '../types';

export interface ReindexProgress {
  total: number;
  processed: number;
  reindexed: number;
  failed: number;
  currentId: number | null;
}

export interface ReindexResult extends ReindexProgress {
  /** Notas que já possuiam embedding válido e não foram reprocessadas. */
  skipped: number;
}

export interface ReindexDeps {
  getEmbedding: (text: string) => Promise<number[]>;
  updateNote: (
    id: number,
    content: string,
    embedding: number[],
    tags?: string,
    pinned?: boolean,
    reminderAt?: string | null,
  ) => Promise<void>;
  onProgress?: (progress: ReindexProgress) => void;
}

const defaultDeps: ReindexDeps = { getEmbedding, updateNote };

/** Separa as notas que realmente precisam de reindexação das que já são pesquisáveis. */
export function selectNotesToReindex(notes: Note[]): Note[] {
  return notes.filter(note => !hasValidEmbedding(note));
}

/**
 * Gera embeddings apenas para notas sem vetor válido.
 *
 * Não é transacional nem destrutivo: uma falha apenas marca a nota e segue o
 * lote, mantendo intactos os embeddings já existentes.
 *
 * As dependências são mescladas com as padrão, permitindo injetar apenas
 * `onProgress` (ou substituições parciais) em testes e no chamador.
 */
export async function reindexNotes(
  notes: Note[],
  overrides: Partial<ReindexDeps> = {},
): Promise<ReindexResult> {
  const deps: ReindexDeps = { ...defaultDeps, ...overrides };
  const pending = selectNotesToReindex(notes);
  const progress: ReindexProgress = {
    total: pending.length,
    processed: 0,
    reindexed: 0,
    failed: 0,
    currentId: null,
  };

  const report = () => deps.onProgress?.({ ...progress });

  for (const note of pending) {
    progress.currentId = note.id;
    report();

    try {
      const embedding = await deps.getEmbedding(note.content);

      if (!Array.isArray(embedding) || embedding.length === 0) {
        throw new Error('O serviço de embeddings retornou um vetor vazio.');
      }

      // Persistência só ocorre após obter o vetor: erro de rede nunca
      // sobrescreve um embedding existente.
      await deps.updateNote(
        note.id,
        note.content,
        embedding,
        note.tags ?? '',
        note.pinned ?? false,
        note.reminder_at ?? null,
      );

      note.embedding = JSON.stringify(embedding);
      note.parsedEmbedding = embedding;
      progress.reindexed += 1;
    } catch {
      // A nota permanece como estava (sem embedding ou com o embedding anterior).
      progress.failed += 1;
    }

    progress.processed += 1;
    progress.currentId = null;
    report();
  }

  report();

  return { ...progress, skipped: notes.length - pending.length };
}