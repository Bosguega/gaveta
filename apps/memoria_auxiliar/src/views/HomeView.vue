<script setup lang="ts">
import { onMounted, onUnmounted, computed, ref } from 'vue';
import ChatPanel from '../components/ChatPanel.vue';
import NoteForm from '../components/NoteForm.vue';
import ResultsList from '../components/ResultsList.vue';
import SearchBox from '../components/SearchBox.vue';
import SettingsView from '../views/SettingsView.vue';
import { deleteNote, deleteAllNotes, listNotes, saveNote, updateNote } from '../services/databaseService';
import { getEmbedding } from '../services/embeddingService';
import { generateAnswer, summarizeResults } from '../services/llmService';
import { searchBySimilarity } from '../services/similarityService';
import type { ApiErrorLike } from '@bosguega/gaveta-de-bagunca';
import { notesStore, updateStreak } from '../store/notesStore';
import type { Note } from '../types';

const noteFormRef = ref<InstanceType<typeof NoteForm> | null>(null);

async function loadNotes() {
  notesStore.notes = await listNotes();
}

async function createNote(content: string) {
  await runAction(async () => {
    const embedding = await getEmbedding(content);
    if (notesStore.editingNote) {
      await updateNote(notesStore.editingNote.id, content, embedding);
      const updatedNote = { ...notesStore.editingNote, content, embedding: JSON.stringify(embedding) };
      notesStore.notes = notesStore.notes.map(n => n.id === updatedNote.id ? updatedNote : n);
      notesStore.results = notesStore.results.map(r => r.note.id === updatedNote.id ? { ...r, note: updatedNote } : r);
      notesStore.editingNote = null;
    } else {
      const note = await saveNote(content, embedding);
      notesStore.notes = [note, ...notesStore.notes];
      updateStreak();
    }
  }, notesStore.editingNote ? 'Atualizando nota...' : 'Salvando nota...');
}

function startEdit(note: Note) {
  notesStore.editingNote = note;
  notesStore.activeView = 'add';
}

async function searchNotes(query: string) {
  if (!query.trim()) {
    notesStore.results = [];
    return;
  }
  await runAction(async () => {
    const embedding = await getEmbedding(query);
    notesStore.results = searchBySimilarity(notesStore.notes, embedding, 5, 0.5, query.length);
    notesStore.summary = '';
  }, 'Buscando notas similares...');
}

function showConfirmModal(message: string, action: () => void) {
  notesStore.confirmModal.message = message;
  notesStore.confirmModal.onConfirm = action;
  notesStore.confirmModal.show = true;
}

function closeConfirmModal() {
  notesStore.confirmModal.show = false;
}

function confirmAction() {
  notesStore.confirmModal.onConfirm();
  closeConfirmModal();
}

async function removeNote(id: number) {
  showConfirmModal('Tem certeza que deseja excluir esta nota?', async () => {
    await runAction(async () => {
      await deleteNote(id);
      notesStore.notes = notesStore.notes.filter(n => n.id !== id);
      notesStore.results = notesStore.results.filter(r => r.note.id !== id);
    }, 'Excluindo nota...');
  });
}

async function clearAllNotes() {
  showConfirmModal('Tem certeza que deseja excluir TODAS as notas? Esta ação não pode ser desfeita.', async () => {
    await runAction(async () => {
      await deleteAllNotes();
      notesStore.notes = [];
      notesStore.results = [];
      notesStore.messages = [];
      // Reset stats
      notesStore.stats.streak = 0;
      notesStore.stats.lastUse = null;
      localStorage.setItem('memoria_auxiliar_stats', JSON.stringify(notesStore.stats));
    }, 'Excluindo todas as notas...');
  });
}

async function generateSummary() {
  await runAction(async () => {
    notesStore.summary = await summarizeResults(notesStore.results);
  }, 'Gerando resumo...');
}

async function askAI(question: string) {
  await runAction(async () => {
    // 1. Adiciona pergunta ao chat
    notesStore.messages.push({ role: 'user', content: question });

    // 2. Busca contexto relevante via similaridade vetorial
    const embedding = await getEmbedding(question);
    const retrievedResults = searchBySimilarity(notesStore.notes, embedding, 10, 0.5, question.length);

    // 3. Gera resposta - o backend envia as notas formatadas com [MEMORY_ID: N]
    //    e a LLM retorna quais IDs foram realmente utilizados
    const { answer, usedIds } = await generateAnswer(question, retrievedResults);

    // 4. Filtra as fontes: usadas vs. apenas recuperadas
    const usedSources = retrievedResults.filter(r => usedIds.includes(r.note.id));

    // 5. Adiciona resposta ao chat com separação clara
    notesStore.messages.push({
      role: 'assistant',
      content: answer,
      usedSources: usedSources,
      retrievedSources: retrievedResults,
      usedIds: usedIds,
    });
  }, 'Pensando na resposta...');
}

async function runAction(action: () => Promise<void>, message = 'Processando...') {
  notesStore.loading = true;
  notesStore.loadingMessage = message;
  notesStore.error = null;

  try {
    await action();
  } catch (error) {
    // Erros do Tauri vêm como objeto com code, message, status_code
    if (typeof error === 'object' && error !== null && 'code' in error && 'message' in error) {
      notesStore.error = error as ApiErrorLike;
    } else if (error instanceof Error) {
      notesStore.error = { code: 'UNKNOWN_ERROR' as const, message: error.message };
    } else {
      notesStore.error = { code: 'UNKNOWN_ERROR' as const, message: 'Erro inesperado.' };
    }
  } finally {
    notesStore.loading = false;
    notesStore.loadingMessage = '';
  }
}

function handleKeydown(event: KeyboardEvent) {
  if (event.ctrlKey && event.key === 's') {
    event.preventDefault();
    if (notesStore.activeView === 'add' && noteFormRef.value) {
      noteFormRef.value.submit();
    }
  } else if (event.key === 'Escape') {
    if (notesStore.editingNote) {
      notesStore.editingNote = null;
    }
  }
}

onMounted(() => {
  runAction(loadNotes);
  document.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown);
});

const notesThisWeek = computed(() => {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  return notesStore.notes.filter(note => new Date(note.created_at) > weekAgo).length;
});

const topKeywords = computed(() => {
  const words: { [key: string]: number } = {};
  notesStore.notes.forEach(note => {
    note.content.toLowerCase().split(/\s+/).forEach(word => {
      if (word.length > 3) words[word] = (words[word] || 0) + 1;
    });
  });
  return Object.entries(words)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .map(([word]) => word);
});
</script>

<template>
  <main class="app-shell">
    <header>
      <div class="header-content">
        <p>Memoria Auxiliar</p>
        <h1>Sua segunda mente com IA</h1>
        <p class="notes-count">{{ notesStore.notes.length }} notas salvas • {{ notesStore.stats.streak }} dias seguidos</p>
      </div>
      
      <nav class="main-nav">
        <button 
          :class="{ active: notesStore.activeView === 'search' }"
          @click="notesStore.activeView = 'search'"
        >
          Pesquisar
        </button>
        <button 
          :class="{ active: notesStore.activeView === 'add' }"
          @click="notesStore.activeView = 'add'"
        >
          {{ notesStore.editingNote ? 'Editar Dica' : 'Incluir Dicas' }}
        </button>
        <button
          :class="{ active: notesStore.activeView === 'chat' }"
          @click="notesStore.activeView = 'chat'"
        >
          Conversar (RAG)
        </button>
        <button
          :class="{ active: notesStore.activeView === 'insights' }"
          @click="notesStore.activeView = 'insights'"
        >
          Insights
        </button>
        <button
          :class="{ active: notesStore.activeView === 'settings' }"
          @click="notesStore.activeView = 'settings'"
        >
          ⚙️ Config
        </button>
      </nav>
    </header>

    <div v-if="notesStore.loading" class="status-overlay">
      <div class="spinner"></div>
      <span>{{ notesStore.loadingMessage || 'Processando...' }}</span>
    </div>
    
    <div v-if="notesStore.error" :class="['error-banner', `error-${(notesStore.error.code || 'unknown').toLowerCase()}`]">
      <div class="error-content">
        <span class="error-icon">
          {{ notesStore.error.code === 'INVALID_API_KEY' ? '🔑' : 
             notesStore.error.code === 'RATE_LIMIT_EXCEEDED' ? '⏳' : 
             notesStore.error.code === 'NETWORK_ERROR' || notesStore.error.code === 'TIMEOUT' ? '🌐' : 
             notesStore.error.code === 'SERVICE_UNAVAILABLE' || notesStore.error.code === 'SERVER_ERROR' ? '🔧' : 
             '⚠️' }}
        </span>
        <p>{{ notesStore.error.message }}</p>
      </div>
      <button
        v-if="notesStore.error.code === 'INVALID_API_KEY'"
        class="error-action"
        @click="notesStore.activeView = 'settings'"
      >
        Ir para Configurações
      </button>
    </div>

    <!-- TELA: PESQUISAR -->
    <div v-if="notesStore.activeView === 'search'" class="view-container">
      <SearchBox @search="searchNotes" />
      <ResultsList :results="notesStore.results" @delete="removeNote" @edit="startEdit" />
      
      <section v-if="notesStore.results.length" class="summary-section">
        <button type="button" class="secondary" @click="generateSummary">
          Gerar resumo com IA
        </button>
        <p v-if="notesStore.summary" class="summary-box">{{ notesStore.summary }}</p>
      </section>
    </div>

    <!-- TELA: INCLUIR DICAS -->
    <div v-if="notesStore.activeView === 'add'" class="view-container">
      <NoteForm ref="noteFormRef" @save="createNote" />
    </div>

    <!-- TELA: RAG CHAT -->
    <div v-if="notesStore.activeView === 'chat'" class="view-container chat-view">
      <ChatPanel @ask="askAI" @edit="startEdit" @delete="removeNote" />
    </div>

    <!-- TELA: INSIGHTS -->
    <div v-if="notesStore.activeView === 'insights'" class="view-container">
      <section class="panel">
        <h2>Insights das suas memórias</h2>
        <p>Notas totais: {{ notesStore.notes.length }}</p>
        <p>Notas esta semana: {{ notesThisWeek }}</p>
        <p>Streak atual: {{ notesStore.stats.streak }} dias</p>
        <p v-if="topKeywords.length">Palavras-chave mais usadas: {{ topKeywords.join(', ') }}</p>
        <button type="button" class="secondary" @click="clearAllNotes" style="margin-top: 20px;">Excluir Todas as Notas</button>
      </section>
    </div>

    <!-- TELA: CONFIGURAÇÕES -->
    <div v-if="notesStore.activeView === 'settings'" class="view-container">
      <SettingsView />
    </div>

    <!-- Modal de Confirmação -->
    <div v-if="notesStore.confirmModal.show" class="modal-overlay" @click="closeConfirmModal">
      <div class="modal-content" @click.stop>
        <h3>Confirmar Ação</h3>
        <p>{{ notesStore.confirmModal.message }}</p>
        <div class="modal-actions">
          <button class="secondary" @click="closeConfirmModal">Cancelar</button>
          <button @click="confirmAction">Confirmar</button>
        </div>
      </div>
    </div>
  </main>
</template>

<style scoped>
.error-banner {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 8px;
  padding: 12px 16px;
  margin: 8px 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.error-content {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
}

.error-icon {
  font-size: 1.2rem;
}

.error-content p {
  margin: 0;
  font-size: 0.9rem;
  color: #ef4444;
}

.error-action {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 6px;
  padding: 6px 14px;
  color: #ef4444;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.error-action:hover {
  background: rgba(239, 68, 68, 0.15);
}
</style>