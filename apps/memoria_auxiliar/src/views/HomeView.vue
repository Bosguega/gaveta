<script setup lang="ts">
import { onMounted, onUnmounted, computed, ref } from 'vue';
import ChatPanel from '../components/ChatPanel.vue';
import NoteForm from '../components/NoteForm.vue';
import ResultsList from '../components/ResultsList.vue';
import SearchBox from '../components/SearchBox.vue';
import { deleteNote, deleteAllNotes, listNotes, saveNote, updateNote } from '../services/databaseService';
import { getEmbedding } from '../services/embeddingService';
import { generateAnswer, summarizeResults } from '../services/llmService';
import { searchBySimilarity } from '../services/similarityService';
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
  notesStore.error = '';

  try {
    await action();
  } catch (error) {
    notesStore.error = error instanceof Error ? error.message : 'Erro inesperado.';
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
      </nav>
    </header>

    <div v-if="notesStore.loading" class="status-overlay">
      <div class="spinner"></div>
      <span>{{ notesStore.loadingMessage || 'Processando...' }}</span>
    </div>
    
    <div v-if="notesStore.error" class="error-banner">{{ notesStore.error }}</div>

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
