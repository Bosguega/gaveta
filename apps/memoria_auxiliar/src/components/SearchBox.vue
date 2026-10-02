<script setup lang="ts">
import { ref, watch, computed, onMounted, onUnmounted } from 'vue';
import { notesStore } from '../store/notesStore';
import { hasActiveFilters } from '../utils/searchFilters';
import type { EmbeddingFilter, PeriodFilter } from '../utils/searchFilters';

const emit = defineEmits<{
  search: [query: string];
}>();

const PERIOD_OPTIONS: { value: PeriodFilter; label: string }[] = [
  { value: 'all', label: 'Qualquer data' },
  { value: '7d', label: 'Últimos 7 dias' },
  { value: '30d', label: 'Últimos 30 dias' },
  { value: 'month', label: 'Este mês' },
  { value: 'lastYear', label: 'Ano passado' },
];

const EMBEDDING_OPTIONS: { value: EmbeddingFilter; label: string }[] = [
  { value: 'any', label: 'Embedding: todos' },
  { value: 'with', label: 'Com embedding' },
  { value: 'without', label: 'Sem embedding' },
];

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
    timeout = null;
    emit('search', newVal.trim());
  }, 300);
});

function submit() {
  // Busca imediata: cancela o debounce pendente para não disparar uma segunda
  // requisição com o mesmo texto logo em seguida.
  if (timeout) {
    clearTimeout(timeout);
    timeout = null;
  }
  emit('search', query.value.trim());
}

onUnmounted(() => {
  // Evita busca fire-and-forget após o componente sair da tela.
  if (timeout) clearTimeout(timeout);
});

function selectTag(tag: string | null) {
  // Clicar na mesma tag desmarca o filtro.
  notesStore.filters.tag = notesStore.filters.tag === tag ? null : tag;
}

function resetFilters() {
  notesStore.filters.tag = null;
  notesStore.filters.period = 'all';
  notesStore.filters.pinnedOnly = false;
  notesStore.filters.withReminder = false;
  notesStore.filters.embedding = 'any';
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
      <div v-if="notesStore.searchFallbackMode" class="fallback-badge" title="Buscando por texto direto (embeddings indisponíveis ou sem embeddings)">
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
        :class="{ active: notesStore.filters.tag === null }"
        @click="selectTag(null)"
      >
        Todas
      </button>
      <button
        v-for="tag in allTags"
        :key="tag"
        class="tag-pill"
        :class="{ active: notesStore.filters.tag === tag }"
        @click="selectTag(tag)"
      >
        #{{ tag }}
      </button>
    </div>

    <!-- Filtros combináveis: período, fixadas, lembrete e embedding -->
    <div class="filters-bar">
      <span class="tags-title">Filtros:</span>
      <select v-model="notesStore.filters.period" class="filter-select" title="Filtrar por período de criação">
        <option v-for="option in PERIOD_OPTIONS" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
      </select>

      <select v-model="notesStore.filters.embedding" class="filter-select" title="Filtrar por embedding válido">
        <option v-for="option in EMBEDDING_OPTIONS" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
      </select>

      <button
        class="tag-pill"
        :class="{ active: notesStore.filters.pinnedOnly }"
        @click="notesStore.filters.pinnedOnly = !notesStore.filters.pinnedOnly"
      >
        📌 Fixadas
      </button>
      <button
        class="tag-pill"
        :class="{ active: notesStore.filters.withReminder }"
        @click="notesStore.filters.withReminder = !notesStore.filters.withReminder"
      >
        ⏰ Com lembrete
      </button>

      <button
        v-if="hasActiveFilters(notesStore.filters)"
        class="tag-pill clear"
        @click="resetFilters"
      >
        ✕ Limpar filtros
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

.filters-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 8px;
}

.filter-select {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--border);
  color: var(--text-secondary);
  padding: 3px 8px;
  border-radius: 14px;
  font-size: 0.75rem;
  cursor: pointer;
  font-family: inherit;
}

.filter-select:focus {
  outline: none;
  border-color: var(--accent);
}

.tag-pill.clear {
  color: #ef4444;
  border-color: rgba(239, 68, 68, 0.3);
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

