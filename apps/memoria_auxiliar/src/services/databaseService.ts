import { invoke } from '@tauri-apps/api/core';
import type { ChatSession, Note } from '../types';

export async function saveNote(
  content: string,
  embedding: number[],
  tags = '',
  pinned = false,
  reminder_at: string | null = null,
): Promise<Note> {
  return invoke<Note>('save_note', {
    content,
    embedding: JSON.stringify(embedding),
    tags,
    pinned,
    reminderAt: reminder_at,
  });
}

export async function listNotes(): Promise<Note[]> {
  const notes = await invoke<Note[]>('list_notes');
  return notes.map((note) => {
    try {
      note.parsedEmbedding = JSON.parse(note.embedding);
    } catch {
      note.parsedEmbedding = undefined;
    }
    return note;
  });
}

export async function searchNotesText(query: string, limit = 20): Promise<Note[]> {
  const notes = await invoke<Note[]>('search_notes_text', { query, limit });
  return notes.map((note) => {
    try {
      note.parsedEmbedding = JSON.parse(note.embedding);
    } catch {
      note.parsedEmbedding = undefined;
    }
    return note;
  });
}

export async function deleteNote(id: number): Promise<void> {
  await invoke('delete_note', { id });
}

export async function updateNote(
  id: number,
  content: string,
  embedding: number[],
  tags = '',
  pinned = false,
  reminder_at: string | null = null,
): Promise<void> {
  await invoke('update_note', {
    id,
    content,
    embedding: JSON.stringify(embedding),
    tags,
    pinned,
    reminderAt: reminder_at,
  });
}

export async function togglePinNote(id: number): Promise<boolean> {
  return invoke<boolean>('toggle_pin_note', { id });
}

export async function deleteAllNotes(): Promise<void> {
  await invoke('delete_all_notes');
}

export async function exportNotesJson(): Promise<string> {
  return invoke<string>('export_notes_json');
}

export async function importNotesJson(jsonData: string): Promise<number> {
  return invoke<number>('import_notes_json', { jsonData });
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

// ── Chat History ──

export async function getChatHistory(): Promise<ChatSession[]> {
  return invoke<ChatSession[]>('get_chat_history');
}

export async function saveChatSession(
  id: number | null,
  title: string,
  messages: string,
): Promise<number> {
  return invoke<number>('save_chat_session', { id, title, messages });
}

export async function deleteChatSession(id: number): Promise<void> {
  await invoke('delete_chat_session', { id });
}

export async function clearChatHistory(): Promise<void> {
  await invoke('clear_chat_history');
}