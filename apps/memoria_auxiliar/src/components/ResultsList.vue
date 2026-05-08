<script setup lang="ts">
import type { Note, SearchResult } from '../types';

defineProps<{
  results: SearchResult[];
}>();

const emit = defineEmits<{
  delete: [id: number];
  edit: [note: Note];
}>();

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('pt-BR');
}
</script>

<template>
  <section class="panel results-panel">
    <h2>Resultados</h2>

    <p v-if="!results.length" class="muted">Nenhum resultado ainda.</p>

    <ol v-else class="results-list">
      <li v-for="result in results" :key="result.note.id">
        <div class="result-content">
          <p><strong># Memória {{ result.note.id }}:</strong> {{ result.note.content }}</p>
          <div class="result-meta">
            <span>Score: {{ result.score.toFixed(3) }}</span>
            <span>Data: {{ formatDate(result.note.created_at) }}</span>
            <div class="actions">
              <button class="edit-btn" @click="emit('edit', result.note)" title="Editar nota" aria-label="Editar nota">Editar</button>
              <button class="delete-btn" @click="emit('delete', result.note.id)" title="Excluir nota" aria-label="Excluir nota">Excluir</button>
            </div>
          </div>
        </div>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.result-content {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  width: 100%;
}
.result-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.8rem;
  flex-wrap: wrap;
  gap: 8px;
}
.actions {
  display: flex;
  gap: 8px;
}
.edit-btn {
  background: #6b7280;
  color: white;
  border: none;
  padding: 2px 8px;
  border-radius: 4px;
  cursor: pointer;
}
.edit-btn:hover {
  background: #4b5563;
}
.delete-btn {
  background: #ff4444;
  color: white;
  border: none;
  padding: 2px 8px;
  border-radius: 4px;
  cursor: pointer;
}
.delete-btn:hover {
  background: #cc0000;
}
</style>
