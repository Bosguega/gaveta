<script setup lang="ts">
import { ref, onUpdated, watch } from 'vue';
import { notesStore } from '../store/notesStore';
import type { Note } from '../types';
import InteractiveContent from './InteractiveContent.vue';

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('pt-BR');
}

const emit = defineEmits<{
  ask: [question: string];
  edit: [note: Note];
  delete: [id: number];
}>();

const question = ref('');
const chatHistory = ref<HTMLElement | null>(null);
const debugExpanded = ref<Record<number, boolean>>({});

function toggleDebug(index: number) {
  debugExpanded.value[index] = !debugExpanded.value[index];
}

function submit() {
  const value = question.value.trim();
  if (!value) return;
  
  emit('ask', value);
  question.value = '';
}

function startEdit(note: Note) {
  emit('edit', note);
}

function confirmDelete(id: number) {
  emit('delete', id);
}

function scrollToBottom() {
  if (chatHistory.value) {
    chatHistory.value.scrollTop = chatHistory.value.scrollHeight;
  }
}

watch(() => notesStore.messages.length, () => {
  setTimeout(scrollToBottom, 100);
});

onUpdated(scrollToBottom);
</script>

<template>
  <section class="chat-container">
    <div ref="chatHistory" class="chat-history">
      <div v-if="notesStore.messages.length === 0" class="empty-chat">
        <div class="chat-icon">💬</div>
        <h3>Como posso ajudar você hoje?</h3>
        <p>Faça uma pergunta baseada nas suas notas salvas.</p>
      </div>

      <div 
        v-for="(msg, index) in notesStore.messages" 
        :key="index" 
        :class="['message-wrapper', msg.role]"
      >
        <div class="message-bubble">
          <span class="role-tag">{{ msg.role === 'user' ? 'Você' : 'Assistente' }}</span>
          <p class="content">{{ msg.content }}</p>
        </div>

        <!-- Cards de Memórias USADAS pela LLM -->
        <div v-if="msg.usedSources && msg.usedSources.length > 0" class="sources-container">
          <p class="sources-title">Memórias utilizadas:</p>
          <div class="sources-grid">
            <div 
              v-for="source in msg.usedSources" 
              :key="source.note.id" 
              class="source-card"
            >
              <div class="source-score">{{ (source.score * 100).toFixed(0) }}%</div>
              <InteractiveContent :text="'# Memória ' + source.note.id + ': ' + source.note.content" />
              <small>Data: {{ formatDate(source.note.created_at) }}</small>
              
              <div class="source-actions">
                <button class="action-btn edit" @click="startEdit(source.note)" title="Editar nota" aria-label="Editar nota">
                  ✏️
                </button>
                <button class="action-btn delete" @click="confirmDelete(source.note.id)" title="Excluir nota" aria-label="Excluir nota">
                  🗑️
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Seção colapsável: Memórias Consideradas (debug) -->
        <div v-if="msg.retrievedSources && msg.retrievedSources.length > 0" class="debug-section">
          <button class="debug-toggle" @click="toggleDebug(index)">
            <span class="debug-icon">{{ debugExpanded[index] ? '▼' : '▶' }}</span>
            Memórias consideradas ({{ msg.retrievedSources.length }})
          </button>
          
          <div v-if="debugExpanded[index]" class="debug-content">
            <div 
              v-for="source in msg.retrievedSources" 
              :key="'debug-' + source.note.id"
              :class="['debug-item', { 'not-used': !msg.usedIds?.includes(source.note.id) }]"
            >
              <div class="debug-header">
                <span class="debug-badge" :class="{ used: msg.usedIds?.includes(source.note.id) }">
                  {{ msg.usedIds?.includes(source.note.id) ? '✓ Usada' : '✗ Descartada' }}
                </span>
                <span class="debug-score">Score: {{ (source.score * 100).toFixed(1) }}%</span>
                <span class="debug-date">{{ formatDate(source.note.created_at) }}</span>
              </div>
              <InteractiveContent :text="'#' + source.note.id + ': ' + source.note.content" class="debug-content-text" />
            </div>
          </div>
        </div>
      </div>

      <div v-if="notesStore.loading" class="message-wrapper assistant">
        <div class="message-bubble loading-bubble">
          <div class="typing-dots">
            <span></span><span></span><span></span>
          </div>
        </div>
      </div>
    </div>
    
    <div class="chat-input-area">
      <form class="chat-form" @submit.prevent="submit">
        <input 
          v-model="question" 
          type="text" 
          placeholder="Digite sua pergunta aqui..."
          :disabled="notesStore.loading"
        />
        <button type="submit" :disabled="notesStore.loading || !question.trim()">
          <span v-if="!notesStore.loading">Enviar</span>
          <span v-else class="spinner-small"></span>
        </button>
      </form>
    </div>
  </section>
</template>

<style scoped>
.chat-container {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 200px);
  background: rgba(255, 255, 255, 0.02);
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  overflow: hidden;
}

.chat-history {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.empty-chat {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  opacity: 0.5;
  text-align: center;
}

.chat-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.message-wrapper {
  display: flex;
  flex-direction: column;
  max-width: 85%;
}

.message-wrapper.user {
  align-self: flex-end;
}

.message-wrapper.assistant {
  align-self: flex-start;
}

.message-bubble {
  padding: 14px 18px;
  border-radius: 18px;
  position: relative;
  line-height: 1.6;
}

.user .message-bubble {
  background: var(--primary-color, #3b82f6);
  color: white;
  border-bottom-right-radius: 4px;
}

.assistant .message-bubble {
  background: rgba(255, 255, 255, 0.07);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-bottom-left-radius: 4px;
}

.role-tag {
  font-size: 0.65rem;
  font-weight: 800;
  text-transform: uppercase;
  margin-bottom: 6px;
  display: block;
  opacity: 0.7;
}

.content {
  margin: 0;
  font-size: 0.95rem;
  white-space: pre-wrap;
}

/* Sources styling - used memories */
.sources-container {
  margin-top: 12px;
  width: 100%;
}

.sources-title {
  font-size: 0.75rem;
  font-weight: 600;
  margin-bottom: 8px;
  opacity: 0.6;
}

.sources-grid {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  padding-bottom: 8px;
}

.source-card {
  min-width: 180px;
  max-width: 250px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 10px;
  padding: 10px;
  position: relative;
}

.source-card p {
  font-size: 0.8rem;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  opacity: 0.8;
  margin-bottom: 4px;
}

.source-card small {
  font-size: 0.7rem;
  opacity: 0.6;
  margin-bottom: 8px;
  display: block;
}

.source-actions {
  display: flex;
  gap: 8px;
  margin-top: auto;
  opacity: 0;
  transition: opacity 0.2s;
}

.source-card:hover .source-actions {
  opacity: 1;
}

.action-btn {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  padding: 4px 8px;
  cursor: pointer;
  font-size: 0.8rem;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.action-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  transform: translateY(-1px);
}

.action-btn.delete:hover {
  background: rgba(239, 68, 68, 0.2);
  border-color: rgba(239, 68, 68, 0.3);
}

.source-score {
  position: absolute;
  top: -8px;
  right: -8px;
  background: rgba(16, 185, 129, 0.2);
  border: 1px solid rgba(16, 185, 129, 0.3);
  color: #10b981;
  font-size: 0.6rem;
  padding: 2px 6px;
  border-radius: 10px;
  font-weight: bold;
}

/* Debug section - all retrieved memories */
.debug-section {
  margin-top: 8px;
  width: 100%;
}

.debug-toggle {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  padding: 6px 12px;
  cursor: pointer;
  font-size: 0.7rem;
  color: var(--text-secondary);
  width: 100%;
  text-align: left;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.2s;
}

.debug-toggle:hover {
  background: rgba(255, 255, 255, 0.06);
}

.debug-icon {
  font-size: 0.6rem;
}

.debug-content {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.debug-item {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.04);
  border-radius: 8px;
  padding: 8px 10px;
}

.debug-item.not-used {
  opacity: 0.6;
}

.debug-header {
  display: flex;
  gap: 8px;
  align-items: center;
  font-size: 0.65rem;
  margin-bottom: 4px;
}

.debug-badge {
  padding: 1px 6px;
  border-radius: 4px;
  font-weight: 600;
  font-size: 0.6rem;
}

.debug-badge.used {
  background: rgba(16, 185, 129, 0.15);
  color: #10b981;
  border: 1px solid rgba(16, 185, 129, 0.2);
}

.debug-badge:not(.used) {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.15);
}

.debug-score {
  color: var(--text-secondary);
}

.debug-date {
  color: var(--text-secondary);
  margin-left: auto;
}

.debug-content-text {
  font-size: 0.75rem;
  margin: 0;
  opacity: 0.7;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.chat-input-area {
  padding: 20px;
  background: rgba(0, 0, 0, 0.2);
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.chat-form {
  display: flex;
  gap: 12px;
}

.chat-form input {
  flex: 1;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 12px 20px;
  border-radius: 25px;
  color: white;
  outline: none;
  transition: all 0.2s;
}

.chat-form input:focus {
  border-color: var(--primary-color, #3b82f6);
  background: rgba(255, 255, 255, 0.08);
}

.chat-form button {
  border-radius: 25px;
  padding: 0 24px;
  background: var(--primary-color, #3b82f6);
  font-weight: 600;
  transition: transform 0.1s;
}

.chat-form button:active {
  transform: scale(0.95);
}

.chat-form button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Loading animation */
.loading-bubble {
  padding: 12px 18px;
}

.typing-dots {
  display: flex;
  gap: 4px;
}

.typing-dots span {
  width: 8px;
  height: 8px;
  background: currentColor;
  border-radius: 50%;
  opacity: 0.4;
  animation: typing 1.4s infinite both;
}

.typing-dots span:nth-child(2) { animation-delay: 0.2s; }
.typing-dots span:nth-child(3) { animation-delay: 0.4s; }

@keyframes typing {
  0%, 80%, 100% { transform: scale(0.6); }
  40% { transform: scale(1); opacity: 1; }
}

.spinner-small {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>