<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { notesStore, analyzeClipboardContent, showToast } from '../store/notesStore';

const emit = defineEmits<{
  save: [content: string, tags?: string, pinned?: boolean, reminder_at?: string | null];
}>();

const content = ref('');
const tags = ref('');
const reminder = ref<string | null>(null);
const error = ref('');

// Sync with store editing note
watch(() => notesStore.editingNote, (note) => {
  if (note) {
    content.value = note.content;
    tags.value = note.tags || '';
    reminder.value = note.reminder_at ? note.reminder_at.slice(0, 16) : null;
    error.value = '';
  } else {
    content.value = '';
    tags.value = '';
    reminder.value = null;
    error.value = '';
  }
}, { immediate: true });

// Track dirty state for guard
watch([content, tags, reminder], () => {
  notesStore.formDirtyContent = content.value.trim() || tags.value.trim() || (reminder.value ? 'reminder' : '');
});

// Auto-extracted tags from text (#hashtag)
const autoTags = computed(() => {
  const matches = content.value.match(/#[\wÀ-ÿ-]+/g) || [];
  return [...new Set(matches.map(t => t.slice(1).toLowerCase()))];
});

async function pasteFromClipboard() {
  try {
    const text = await navigator.clipboard.readText();
    if (!text.trim()) {
      showToast('Área de transferência vazia', 'info');
      return;
    }
    const analysis = analyzeClipboardContent(text);
    content.value = content.value ? `${content.value}\n\n${analysis.formatted}` : analysis.formatted;
    if (analysis.suggestedTags.length) {
      const currentTags = tags.value.split(',').map(t => t.trim()).filter(Boolean);
      tags.value = [...new Set([...currentTags, ...analysis.suggestedTags])].join(', ');
    }
    showToast(`Conteúdo colado (${analysis.type.toUpperCase()})`, 'info');
  } catch (err) {
    console.error('Falha ao ler clipboard:', err);
    showToast('Permissão de clipboard necessária', 'error');
  }
}

function setQuickReminder(preset: 'today18' | 'tomorrow09' | 'in3days') {
  const d = new Date();
  if (preset === 'today18') {
    d.setHours(18, 0, 0, 0);
  } else if (preset === 'tomorrow09') {
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
  } else if (preset === 'in3days') {
    d.setDate(d.getDate() + 3);
    d.setHours(9, 0, 0, 0);
  }
  reminder.value = d.toISOString().slice(0, 16);
}

function validateContent(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return 'A nota não pode estar vazia.';
  }
  if (trimmed.length < 3) {
    return 'A nota deve ter pelo menos 3 caracteres.';
  }
  if (trimmed.length > 5000) {
    return 'A nota deve ter no máximo 5000 caracteres.';
  }
  return '';
}

function submit() {
  const value = content.value.trim();
  const validationError = validateContent(value);
  if (validationError) {
    error.value = validationError;
    return;
  }

  // Combine manual tags and auto #tags
  const manualTagList = tags.value.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
  const combinedTags = [...new Set([...manualTagList, ...autoTags.value])].join(', ');

  const pinned = notesStore.editingNote?.pinned ?? false;

  emit('save', value, combinedTags, pinned, reminder.value);
  content.value = '';
  tags.value = '';
  reminder.value = null;
  error.value = '';
  notesStore.formDirtyContent = '';
}

defineExpose({ submit });

function cancel() {
  notesStore.editingNote = null;
  content.value = '';
  tags.value = '';
  reminder.value = null;
  error.value = '';
  notesStore.formDirtyContent = '';
}
</script>

<template>
  <section class="panel">
    <div class="panel-header">
      <h2>{{ notesStore.editingNote ? 'Editar nota' : 'Nova nota' }}</h2>
      <div class="header-right">
        <button type="button" class="btn-clipboard" @click="pasteFromClipboard" title="Colar & Auto-detectar código/links">
          📋 Colar Inteligente
        </button>
        <span class="char-count">{{ content.length }}/5000</span>
      </div>
    </div>
    <form class="note-form" @submit.prevent="submit">
      <textarea
        v-model="content"
        rows="4"
        placeholder="Ex.: Reunião de planejamento na quinta #trabalho. Suporta Markdown, URLs e caminhos C:\..."
        :class="{ error: error }"
      />
      <p v-if="error" class="error-message">{{ error }}</p>

      <div class="tags-input-group">
        <label for="tags-input">Tags (separadas por vírgula):</label>
        <input
          id="tags-input"
          v-model="tags"
          type="text"
          placeholder="trabalho, ideias, projeto..."
          class="tags-field"
        />
      </div>

      <!-- Reminder Section -->
      <div class="reminder-input-group">
        <label for="reminder-input">⏰ Lembrete / Notificação:</label>
        <div class="reminder-controls">
          <input
            id="reminder-input"
            v-model="reminder"
            type="datetime-local"
            class="reminder-field"
          />
          <div class="quick-reminder-pills">
            <button type="button" class="pill-btn" @click="setQuickReminder('today18')">Hoje 18h</button>
            <button type="button" class="pill-btn" @click="setQuickReminder('tomorrow09')">Amanhã 09h</button>
            <button type="button" class="pill-btn" @click="setQuickReminder('in3days')">Em 3 dias</button>
            <button v-if="reminder" type="button" class="pill-btn clear" @click="reminder = null">✕ Limpar</button>
          </div>
        </div>
      </div>

      <div v-if="autoTags.length" class="auto-tags-preview">
        <span class="auto-tags-label">Tags detectadas:</span>
        <span v-for="tag in autoTags" :key="tag" class="tag-badge">#{{ tag }}</span>
      </div>

      <div class="form-actions">
        <button type="submit">{{ notesStore.editingNote ? 'Atualizar' : 'Salvar Nota' }}</button>
        <button v-if="notesStore.editingNote" type="button" class="secondary" @click="cancel">Cancelar</button>
        <span class="shortcut-hint">Pressione <kbd>Ctrl+S</kbd> para salvar</span>
      </div>
    </form>
  </section>
</template>

<style scoped>
.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.panel-header h2 {
  margin: 0;
}

.char-count {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.note-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

textarea {
  width: 100%;
  background: var(--bg-color, #0f172a);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 12px;
  color: var(--text-primary);
  font-family: inherit;
  font-size: 0.95rem;
  line-height: 1.5;
  resize: vertical;
  outline: none;
  transition: border-color 0.2s;
}

textarea:focus {
  border-color: var(--accent);
}

textarea.error {
  border-color: var(--error);
}

.error-message {
  color: var(--error);
  font-size: 0.85rem;
  margin: 0;
}

.tags-input-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.tags-input-group label {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.tags-field {
  background: var(--bg-color, #0f172a);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 8px 12px;
  color: var(--text-primary);
  font-size: 0.85rem;
  outline: none;
}

.tags-field:focus {
  border-color: var(--accent);
}

.auto-tags-preview {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.auto-tags-label {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.tag-badge {
  background: rgba(56, 189, 248, 0.15);
  color: var(--accent);
  border: 1px solid rgba(56, 189, 248, 0.3);
  border-radius: 12px;
  padding: 2px 8px;
  font-size: 0.75rem;
  font-weight: 500;
}

.form-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 6px;
  flex-wrap: wrap;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.btn-clipboard {
  background: rgba(56, 189, 248, 0.15);
  color: var(--accent);
  border: 1px solid rgba(56, 189, 248, 0.3);
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-clipboard:hover {
  background: rgba(56, 189, 248, 0.25);
}

.reminder-input-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.reminder-input-group label {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.reminder-controls {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.reminder-field {
  background: var(--bg-color, #0f172a);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 6px 10px;
  color: var(--text-primary);
  font-size: 0.8rem;
  outline: none;
  font-family: inherit;
}

.reminder-field:focus {
  border-color: var(--accent);
}

.quick-reminder-pills {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.pill-btn {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--border);
  color: var(--text-secondary);
  border-radius: 12px;
  padding: 3px 10px;
  font-size: 0.7rem;
  cursor: pointer;
  transition: all 0.15s;
}

.pill-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: var(--text-primary);
}

.pill-btn.clear {
  color: #ef4444;
  border-color: rgba(239, 68, 68, 0.3);
}

kbd {
  background: var(--kbd-bg, rgba(255, 255, 255, 0.1));
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid var(--border);
  font-size: 0.75rem;
}
</style>


