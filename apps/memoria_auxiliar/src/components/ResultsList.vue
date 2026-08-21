<script setup lang="ts">
import type { Note, SearchResult } from '../types';
import InteractiveContent from './InteractiveContent.vue';

defineProps<{
  results: SearchResult[];
}>();

const emit = defineEmits<{
  delete: [id: number];
  edit: [note: Note];
  togglePin: [id: number];
  selectTag: [tag: string];
}>();

function formatDate(dateString: string): string {
  try {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateString;
  }
}

function getTagsArray(tagsString?: string): string[] {
  if (!tagsString) return [];
  return tagsString.split(',').map(t => t.trim()).filter(Boolean);
}

function formatReminder(dateString: string): { label: string; isPast: boolean } {
  try {
    const target = new Date(dateString);
    const now = new Date();
    const isPast = target.getTime() <= now.getTime();
    const label = target.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
    return { label: `⏰ ${isPast ? 'Vencido: ' : 'Lembrete: '}${label}`, isPast };
  } catch {
    return { label: `⏰ ${dateString}`, isPast: false };
  }
}
</script>

<template>
  <section class="panel results-panel">
    <div class="results-header">
      <h2>Resultados</h2>
      <span v-if="results.length" class="results-count">{{ results.length }} notas encontradas</span>
    </div>

    <p v-if="!results.length" class="empty-results">
      Nenhum resultado encontrado. Digite algo na busca ou inclua novas notas.
    </p>

    <ol v-else class="results-list">
      <li v-for="result in results" :key="result.note.id" :class="['result-item', { pinned: result.note.pinned }]">
        <div class="result-content">
          <div class="result-top">
            <span class="memory-badge">#{{ result.note.id }}</span>
            <span v-if="result.score > 0" class="score-badge" title="Similaridade semântica">
              {{ (result.score * 100).toFixed(0) }}%
            </span>
            <span
              v-if="result.note.reminder_at"
              :class="['reminder-badge', { past: formatReminder(result.note.reminder_at).isPast }]"
            >
              {{ formatReminder(result.note.reminder_at).label }}
            </span>
            <button
              class="pin-btn"
              :class="{ active: result.note.pinned }"
              :title="result.note.pinned ? 'Desafixar nota' : 'Fixar no topo'"
              @click="emit('togglePin', result.note.id)"
            >
              📌
            </button>
          </div>

          <div class="result-body">
            <InteractiveContent :text="result.note.content" />
          </div>

          <div v-if="getTagsArray(result.note.tags).length" class="note-tags">
            <button
              v-for="tag in getTagsArray(result.note.tags)"
              :key="tag"
              class="tag-badge-item"
              @click="emit('selectTag', tag)"
            >
              #{{ tag }}
            </button>
          </div>

          <div class="result-meta">
            <span class="date-meta">
              Criado: {{ formatDate(result.note.created_at) }}
              <template v-if="result.note.updated_at && result.note.updated_at !== result.note.created_at">
                • Atualizado: {{ formatDate(result.note.updated_at) }}
              </template>
            </span>
            <div class="actions">
              <button class="edit-btn" @click="emit('edit', result.note)" title="Editar nota">
                ✏️ Editar
              </button>
              <button class="delete-btn" @click="emit('delete', result.note.id)" title="Excluir nota">
                🗑️ Excluir
              </button>
            </div>
          </div>
        </div>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.results-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.results-header h2 {
  margin: 0;
}

.results-count {
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.empty-results {
  color: var(--text-secondary);
  text-align: center;
  padding: 30px;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 12px;
  border: 1px dashed var(--border);
  margin: 0;
}

.results-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.result-item {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 16px;
  transition: all 0.2s;
}

.result-item:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(56, 189, 248, 0.3);
}

.result-item.pinned {
  border-left: 3px solid #fbbf24;
  background: rgba(251, 191, 36, 0.03);
}

.result-content {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
}

.result-top {
  display: flex;
  align-items: center;
  gap: 8px;
}

.memory-badge {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--accent);
  background: rgba(56, 189, 248, 0.1);
  padding: 2px 8px;
  border-radius: 6px;
}

.score-badge {
  font-size: 0.7rem;
  font-weight: 600;
  color: #10b981;
  background: rgba(16, 185, 129, 0.1);
  padding: 2px 6px;
  border-radius: 6px;
}

.reminder-badge {
  font-size: 0.7rem;
  font-weight: 600;
  color: #38bdf8;
  background: rgba(56, 189, 248, 0.12);
  border: 1px solid rgba(56, 189, 248, 0.25);
  padding: 2px 8px;
  border-radius: 6px;
}

.reminder-badge.past {
  color: #ef4444;
  background: rgba(239, 68, 68, 0.12);
  border-color: rgba(239, 68, 68, 0.3);
}

.pin-btn {
  margin-left: auto;
  background: transparent;
  border: none;
  font-size: 0.9rem;
  cursor: pointer;
  opacity: 0.4;
  transition: opacity 0.2s, transform 0.1s;
  padding: 2px;
}

.pin-btn:hover {
  opacity: 1;
  transform: scale(1.1);
}

.pin-btn.active {
  opacity: 1;
}

.result-body {
  font-size: 0.95rem;
  line-height: 1.5;
  color: var(--text-primary);
  white-space: pre-wrap;
  word-break: break-word;
}

.note-tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.tag-badge-item {
  background: rgba(56, 189, 248, 0.1);
  color: var(--accent);
  border: 1px solid rgba(56, 189, 248, 0.2);
  border-radius: 10px;
  padding: 1px 8px;
  font-size: 0.7rem;
  cursor: pointer;
  transition: all 0.15s;
}

.tag-badge-item:hover {
  background: rgba(56, 189, 248, 0.2);
}

.result-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.75rem;
  color: var(--text-secondary);
  flex-wrap: wrap;
  gap: 8px;
  padding-top: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.actions {
  display: flex;
  gap: 6px;
}

.edit-btn, .delete-btn {
  border: none;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.15s;
  display: flex;
  align-items: center;
  gap: 4px;
}

.edit-btn {
  background: rgba(255, 255, 255, 0.08);
  color: var(--text-primary);
}

.edit-btn:hover {
  background: rgba(255, 255, 255, 0.15);
}

.delete-btn {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.delete-btn:hover {
  background: rgba(239, 68, 68, 0.2);
}
</style>

