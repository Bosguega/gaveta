<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue';
import { notesStore, analyzeClipboardContent, showToast } from '../store/notesStore';

const emit = defineEmits<{
  save: [content: string, tags?: string, pinned?: boolean, reminder_at?: string | null];
  close: [];
}>();

const inputRef = ref<HTMLTextAreaElement | null>(null);
const content = ref('');
const tags = ref('');
const reminder = ref<string | null>(null);
const isPinned = ref(false);

onMounted(async () => {
  await nextTick();
  inputRef.value?.focus();
});

function handleClose() {
  notesStore.quickCaptureOpen = false;
  emit('close');
}

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

function submit() {
  const value = content.value.trim();
  if (!value) return;

  emit('save', value, tags.value, isPinned.value, reminder.value);
  handleClose();
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    handleClose();
  } else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    submit();
  }
}
</script>

<template>
  <div class="quick-capture-overlay" @click.self="handleClose" @keydown="handleKeydown">
    <div class="quick-capture-modal">
      <div class="qc-header">
        <div class="qc-title">
          <span class="qc-icon">⚡</span>
          <strong>Captura Rápida</strong>
        </div>
        <div class="qc-header-actions">
          <button class="qc-clipboard-btn" @click="pasteFromClipboard" title="Colar & Auto-detectar tipo">
            📋 Colar Inteligente
          </button>
          <button class="qc-close-btn" @click="handleClose">✕</button>
        </div>
      </div>

      <textarea
        ref="inputRef"
        v-model="content"
        rows="3"
        placeholder="O que está na sua mente? (Ctrl+Enter para salvar instantaneamente)"
        class="qc-input"
      />

      <div class="qc-meta-bar">
        <div class="qc-tags-group">
          <span>🏷️</span>
          <input
            v-model="tags"
            type="text"
            placeholder="Tags (#ideia, #trabalho...)"
            class="qc-tags-field"
          />
        </div>

        <div class="qc-reminder-group">
          <button
            class="qc-pill"
            :class="{ active: reminder !== null }"
            @click="reminder ? reminder = null : setQuickReminder('tomorrow09')"
          >
            ⏰ {{ reminder ? reminder.replace('T', ' ') : 'Lembrete' }}
          </button>
          <button
            class="qc-pill pin"
            :class="{ active: isPinned }"
            @click="isPinned = !isPinned"
            title="Fixar no topo"
          >
            📌 {{ isPinned ? 'Fixada' : 'Fixar' }}
          </button>
        </div>
      </div>

      <div class="qc-footer">
        <div class="qc-hint">
          <kbd>Ctrl + Enter</kbd> Salvar • <kbd>Esc</kbd> Fechar
        </div>
        <button class="qc-submit-btn" :disabled="!content.trim()" @click="submit">
          Salvar Memória
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.quick-capture-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(8px);
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding-top: 15vh;
  z-index: 10000;
  animation: fadeIn 0.15s ease-out;
}

.quick-capture-modal {
  width: min(600px, 92vw);
  background: var(--panel-bg);
  border: 1px solid var(--border);
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(56, 189, 248, 0.2);
  border-radius: 16px;
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.qc-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.qc-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.95rem;
  color: var(--text-primary);
}

.qc-header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.qc-clipboard-btn {
  background: rgba(56, 189, 248, 0.15);
  color: var(--accent);
  border: 1px solid rgba(56, 189, 248, 0.3);
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.qc-clipboard-btn:hover {
  background: rgba(56, 189, 248, 0.25);
}

.qc-close-btn {
  background: transparent;
  border: none;
  color: var(--text-secondary);
  font-size: 1.1rem;
  cursor: pointer;
  padding: 2px 6px;
}

.qc-input {
  width: 100%;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 12px;
  color: var(--text-primary);
  font-family: inherit;
  font-size: 1rem;
  line-height: 1.5;
  outline: none;
  resize: vertical;
  transition: border-color 0.2s;
}

.qc-input:focus {
  border-color: var(--accent);
}

.qc-meta-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.qc-tags-group {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 200px;
}

.qc-tags-field {
  flex: 1;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 6px 10px;
  color: var(--text-primary);
  font-size: 0.8rem;
  outline: none;
}

.qc-tags-field:focus {
  border-color: var(--accent);
}

.qc-reminder-group {
  display: flex;
  gap: 6px;
}

.qc-pill {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--border);
  color: var(--text-secondary);
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.15s;
}

.qc-pill.active {
  background: rgba(56, 189, 248, 0.2);
  color: var(--accent);
  border-color: var(--accent);
}

.qc-pill.pin.active {
  background: rgba(251, 191, 36, 0.2);
  color: #fbbf24;
  border-color: #fbbf24;
}

.qc-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.qc-hint {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.qc-submit-btn {
  background: var(--accent);
  color: #0f172a;
  border: none;
  font-weight: 700;
  padding: 8px 18px;
  border-radius: 8px;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s;
}

.qc-submit-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  filter: brightness(1.1);
}

.qc-submit-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
