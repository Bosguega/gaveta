import { invoke } from '@tauri-apps/api/core';
import type { Note } from '../types';

export async function saveNote(content: string, embedding: number[]): Promise<Note> {
  return invoke<Note>('save_note', {
    content,
    embedding: JSON.stringify(embedding),
  });
}

export async function listNotes(): Promise<Note[]> {
  return invoke<Note[]>('list_notes');
}

export async function deleteNote(id: number): Promise<void> {
  await invoke('delete_note', { id });
}

export async function updateNote(id: number, content: string, embedding: number[]): Promise<void> {
  await invoke('update_note', {
    id,
    content,
    embedding: JSON.stringify(embedding),
  });
}

export async function deleteAllNotes(): Promise<void> {
  await invoke('delete_all_notes');
}

export async function getCachedEmbedding(hash: string): Promise<number[] | null> {
  const embedding = await invoke<string | null>('get_cached_embedding', { hash });
  if (!embedding) {
    return null;
  }

  try {
    const parsed = JSON.parse(embedding) as unknown;
    if (Array.isArray(parsed) && parsed.every((value) => typeof value === 'number')) {
      return parsed;
    }
  } catch {
    return null;
  }

  return null;
}

export async function saveCachedEmbedding(hash: string, embedding: number[]): Promise<void> {
  await invoke('save_cached_embedding', {
    hash,
    embedding: JSON.stringify(embedding),
  });
}
