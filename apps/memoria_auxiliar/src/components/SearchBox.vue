<script setup lang="ts">
import { ref, watch, computed, onMounted } from 'vue';
import { notesStore } from '../store/notesStore';

const emit = defineEmits<{
  search: [query: string];
  filterTag: [tag: string | null];
}>();

const query = ref('');
const searchInputRef = ref<HTMLInputElement | null>(null);
let timeout: ReturnType<typeof setTimeout> | null = null;

const allTags = computed(() => {
  const set = new Set<string>();
  for (const note of notesStore.notes) {
    if (note.tags) {
      note.tags.split(',').forEach(t => {
        const clean = t.trim().toLowerCase();
        if (clean) set.add(clean);
      });
    }
  }
  return Array.from(set).sort();
});

watch(query, (newVal) => {
  if (timeout) clearTimeout(timeout);
  timeout = setTimeout(() => {
    emit('search', newVal.trim());
  }, 300);
});

function submit() {
  const value = query.value.trim();
  emit('search', value);
}

function selectTag(tag: string | null) {
  if (notesStore.selectedTag === tag) {
    notesStore.selectedTag = null;
  } else {
    notesStore.selectedTag = tag;
  }
  emit('filterTag', notesStore.selectedTag);
}

function focus() {
  searchInputRef.value?.focus();
}

defineExpose({ focus, setQuery: (val: string) => { query.value = val; } });
</script>

<template>
  <section class="panel search-panel">
    <div class="search-header">
      <h2>Buscar memória</h2>
      <div v-if="notesStore.searchFallbackMode" class="fallback-badge" title="Buscando por texto direto (Ollama offline ou sem embeddings)">
        Modo texto (fallback)
      </div>
    </div>
    
    <form class="search-form" @submit.prevent="submit">
      <input
        ref="searchInputRef"
        v-model="query"
        type="search"
        placeholder="Busque por similaridade semântica ou palavras-chave (Ctrl+F)..."
      />
      <button type="submit">Buscar</button>
    </form>

    <!-- Tag Filter Bar -->
    <div v-if="allTags.length" class="tags-filter-bar">
      <span class="tags-title">Filtrar por tag:</span>
      <button
        class="tag-pill"
        :class="{ active: notesStore.selectedTag === null }"
        @click="selectTag(null)"
      >
        Todas
      </button>
      <button
        v-for="tag in allTags"
        :key="tag"
        class="tag-pill"
        :class="{ active: notesStore.selectedTag === tag }"
        @click="selectTag(tag)"
      >
        #{{ tag }}
      </button>
    </div>
  </section>
</template>

<style scoped>
.search-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.search-header h2 {
  margin: 0;
}

.fallback-badge {
  font-size: 0.7rem;
  background: rgba(245, 158, 11, 0.15);
  color: #f59e0b;
  border: 1px solid rgba(245, 158, 11, 0.3);
  padding: 3px 8px;
  border-radius: 12px;
  font-weight: 600;
}

.search-form {
  display: flex;
  gap: 10px;
}

.search-form input {
  flex: 1;
  background: var(--bg-color, #0f172a);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 10px 16px;
  color: var(--text-primary);
  font-size: 0.95rem;
  outline: none;
  transition: border-color 0.2s;
}

.search-form input:focus {
  border-color: var(--accent);
}

.tags-filter-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.tags-title {
  font-size: 0.75rem;
  color: var(--text-secondary);
  margin-right: 4px;
}

.tag-pill {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--border);
  color: var(--text-secondary);
  padding: 3px 10px;
  border-radius: 14px;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.2s;
}

.tag-pill:hover {
  background: rgba(255, 255, 255, 0.08);
  color: var(--text-primary);
}

.tag-pill.active {
  background: var(--accent);
  color: #0f172a;
  border-color: var(--accent);
  font-weight: 600;
}
</style>

