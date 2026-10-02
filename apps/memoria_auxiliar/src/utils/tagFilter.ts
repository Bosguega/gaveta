import type { Note } from '../types';

/**
 * Tags são armazenadas como texto separado por vírgula ("a, b, c").
 * A comparação ignora maiúsculas e espaços ao redor de cada tag.
 *
 * Sem tag selecionada, toda nota é candidata.
 */
export function noteMatchesTag(note: Note, tag: string | null | undefined): boolean {
  if (!tag) return true;
  if (!note.tags) return false;

  const target = tag.toLowerCase();
  return note.tags
    .toLowerCase()
    .split(',')
    .map((value) => value.trim())
    .includes(target);
}

/**
 * Restringe as notas a uma tag.
 *
 * Usado como candidatos ANTES da busca por similaridade, para que o limite de
 * resultados seja preenchido por notas que o usuário realmente verá — em vez de
 * aplicar o filtro depois e ficar com uma lista curta.
 */
export function filterNotesByTag(notes: Note[], tag: string | null | undefined): Note[] {
  if (!tag) return notes;
  return notes.filter((note) => noteMatchesTag(note, tag));
}
