<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed } from 'vue'
import { useDeviceUI } from './composables/useDeviceUI'
import { notesStore, updateStreak, resetStats, initStats, showToast, navigateTo } from './store/notesStore'
import { listNotes, saveNote, updateNote, deleteNote, deleteAllNotes, togglePinNote, searchNotesText } from './services/databaseService'
import { getEmbedding } from './services/embeddingService'
import { generateAnswer, summarizeResults } from './services/llmService'
import { searchBySimilarity } from './services/similarityService'
import type { ApiErrorLike } from '@bosguega/ai-core'
import type { Note } from './types'
import ChatPanel from './components/ChatPanel.vue'
import NoteForm from './components/NoteForm.vue'
import ResultsList from './components/ResultsList.vue'
import SearchBox from './components/SearchBox.vue'
import InsightsView from './components/InsightsView.vue'
import SettingsView from './views/SettingsView.vue'
import DeviceToolbar from './components/DeviceToolbar.vue'
import MobileLayout from './layouts/MobileLayout.vue'
import DesktopLayout from './layouts/DesktopLayout.vue'

const isDev = import.meta.env.DEV
const noteFormRef = ref<InstanceType<typeof NoteForm> | null>(null)
const searchBoxRef = ref<InstanceType<typeof SearchBox> | null>(null)
const { resolvedMode } = useDeviceUI()

const isDesktop = computed(() => resolvedMode.value === 'desktop' || resolvedMode.value === 'tablet')

async function loadNotes() {
    notesStore.notes = await listNotes()
}

// Displayed results: either similarity results or all notes filtered by tag
const displayedResults = computed(() => {
    let list = notesStore.results.length > 0
        ? notesStore.results
        : notesStore.notes.map(note => ({ note, score: 0 }))

    if (notesStore.selectedTag) {
        const target = notesStore.selectedTag.toLowerCase()
        list = list.filter(r => {
            if (!r.note.tags) return false
            return r.note.tags.toLowerCase().split(',').map(t => t.trim()).includes(target)
        })
    }

    return list
})

async function createNote(content: string, tags = '', pinned = false) {
    await runAction(async () => {
        let embedding: number[] = []
        try {
            embedding = await getEmbedding(content)
        } catch (e) {
            console.warn('Não foi possível gerar embedding (Ollama offline). Nota será salva sem embedding semântico:', e)
        }

        if (notesStore.editingNote) {
            await updateNote(notesStore.editingNote.id, content, embedding, tags, pinned)
            const updatedNote: Note = {
                ...notesStore.editingNote,
                content,
                embedding: JSON.stringify(embedding),
                parsedEmbedding: embedding.length > 0 ? embedding : undefined,
                tags,
                pinned,
                updated_at: new Date().toISOString(),
            }
            notesStore.notes = notesStore.notes.map(n => n.id === updatedNote.id ? updatedNote : n)
            notesStore.results = notesStore.results.map(r => r.note.id === updatedNote.id ? { ...r, note: updatedNote } : r)
            notesStore.editingNote = null
            showToast('Nota atualizada com sucesso!', 'success')
            navigateTo('search')
        } else {
            const note = await saveNote(content, embedding, tags, pinned)
            note.parsedEmbedding = embedding.length > 0 ? embedding : undefined
            notesStore.notes = [note, ...notesStore.notes]
            updateStreak()
            showToast('Nota salva com sucesso!', 'success')
            navigateTo('search')
        }
    }, notesStore.editingNote ? 'Atualizando nota...' : 'Salvando nota...')
}

function startEdit(note: Note) {
    notesStore.editingNote = note
    navigateTo('add')
}

async function handleTogglePin(id: number) {
    try {
        const isPinned = await togglePinNote(id)
        notesStore.notes = notesStore.notes.map(n => n.id === id ? { ...n, pinned: isPinned } : n)
        // Sort notes: pinned first, then newest
        notesStore.notes.sort((a, b) => {
            if (a.pinned === b.pinned) return b.id - a.id
            return a.pinned ? -1 : 1
        })
        notesStore.results = notesStore.results.map(r => r.note.id === id ? { ...r, note: { ...r.note, pinned: isPinned } } : r)
        showToast(isPinned ? 'Nota fixada no topo' : 'Nota desafixada', 'info')
    } catch (e) {
        console.error('Erro ao alternar fixação:', e)
    }
}

async function searchNotes(query: string) {
    if (!query.trim()) {
        notesStore.results = []
        notesStore.searchFallbackMode = false
        return
    }

    await runAction(async () => {
        try {
            const embedding = await getEmbedding(query)
            notesStore.results = searchBySimilarity(notesStore.notes, embedding, 10, 0.45, query.length)
            notesStore.searchFallbackMode = false
            notesStore.summary = ''
        } catch (embedError) {
            console.warn('Busca semântica indisponível, usando fallback por texto:', embedError)
            notesStore.searchFallbackMode = true
            const textMatches = await searchNotesText(query, 20)
            notesStore.results = textMatches.map(note => ({ note, score: 0 }))
            notesStore.summary = ''
            showToast('Buscando por texto direto (Ollama offline)', 'info')
        }
    }, 'Buscando notas...')
}

function showConfirmModal(message: string, action: () => void) {
    notesStore.confirmModal.message = message
    notesStore.confirmModal.onConfirm = action
    notesStore.confirmModal.show = true
}

function closeConfirmModal() {
    notesStore.confirmModal.show = false
}

function confirmAction() {
    notesStore.confirmModal.onConfirm()
    closeConfirmModal()
}

async function removeNote(id: number) {
    showConfirmModal('Tem certeza que deseja excluir esta nota?', async () => {
        await runAction(async () => {
            await deleteNote(id)
            notesStore.notes = notesStore.notes.filter(n => n.id !== id)
            notesStore.results = notesStore.results.filter(r => r.note.id !== id)
            showToast('Nota excluída.', 'info')
        }, 'Excluindo nota...')
    })
}

async function clearAllNotes() {
    showConfirmModal('Tem certeza que deseja excluir TODAS as notas? Esta ação não pode ser desfeita.', async () => {
        await runAction(async () => {
            await deleteAllNotes()
            notesStore.notes = []
            notesStore.results = []
            notesStore.messages = []
            resetStats()
            showToast('Todas as notas foram excluídas.', 'info')
        }, 'Excluindo todas as notas...')
    })
}

async function generateSummary() {
    await runAction(async () => {
        notesStore.summary = await summarizeResults(displayedResults.value.filter(r => r.score > 0 || notesStore.results.length > 0))
    }, 'Gerando resumo...')
}

async function askAI(question: string) {
    await runAction(async () => {
        notesStore.messages.push({ role: 'user', content: question })

        let retrievedResults = []
        try {
            const embedding = await getEmbedding(question)
            retrievedResults = searchBySimilarity(notesStore.notes, embedding, 10, 0.45, question.length)
        } catch {
            const textMatches = await searchNotesText(question, 10)
            retrievedResults = textMatches.map(note => ({ note, score: 0.5 }))
        }

        const { answer, usedIds } = await generateAnswer(question, retrievedResults)
        const usedSources = retrievedResults.filter(r => usedIds.includes(r.note.id))

        notesStore.messages.push({
            role: 'assistant',
            content: answer,
            usedSources,
            retrievedSources: retrievedResults,
            usedIds,
        })
    }, 'Pensando na resposta...')
}

async function runAction(action: () => Promise<void>, message = 'Processando...') {
    notesStore.loading = true
    notesStore.loadingMessage = message
    notesStore.error = null

    try {
        await action()
    } catch (error) {
        if (typeof error === 'object' && error !== null && 'code' in error && 'message' in error) {
            notesStore.error = error as ApiErrorLike
        } else if (error instanceof Error) {
            notesStore.error = { code: 'UNKNOWN_ERROR' as const, message: error.message }
        } else {
            notesStore.error = { code: 'UNKNOWN_ERROR' as const, message: 'Erro inesperado.' }
        }
    } finally {
        notesStore.loading = false
        notesStore.loadingMessage = ''
    }
}

function handleKeydown(event: KeyboardEvent) {
    // Global Shortcuts
    if (event.ctrlKey) {
        if (event.key === '1') {
            event.preventDefault()
            navigateTo('search')
        } else if (event.key === '2') {
            event.preventDefault()
            navigateTo('add')
        } else if (event.key === '3') {
            event.preventDefault()
            navigateTo('chat')
        } else if (event.key === '4') {
            event.preventDefault()
            navigateTo('insights')
        } else if (event.key === '5') {
            event.preventDefault()
            navigateTo('settings')
        } else if (event.key === 'f' || event.key === 'F') {
            event.preventDefault()
            if (notesStore.activeView !== 'search') {
                navigateTo('search')
            }
            setTimeout(() => {
                searchBoxRef.value?.focus()
            }, 50)
        } else if (event.key === 's' || event.key === 'S') {
            event.preventDefault()
            if (notesStore.activeView === 'add' && noteFormRef.value) {
                noteFormRef.value.submit()
            }
        }
    } else if (event.key === 'Escape') {
        if (notesStore.editingNote) {
            notesStore.editingNote = null
        }
    }
}

onMounted(async () => {
    await initStats()
    runAction(loadNotes)
    document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
    document.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
    <component :is="isDesktop ? DesktopLayout : MobileLayout">
        <!-- TELA: PESQUISAR -->
        <div v-if="notesStore.activeView === 'search'" class="view-container">
            <SearchBox ref="searchBoxRef" @search="searchNotes" />
            <ResultsList
                :results="displayedResults"
                @delete="removeNote"
                @edit="startEdit"
                @toggle-pin="handleTogglePin"
                @select-tag="tag => { notesStore.selectedTag = tag }"
            />
            <section v-if="displayedResults.length" class="summary-section">
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
            <InsightsView @clear-all="clearAllNotes" />
        </div>

        <!-- TELA: CONFIGURAÇÕES -->
        <div v-if="notesStore.activeView === 'settings'" class="view-container">
            <SettingsView @notes-reloaded="loadNotes" />
        </div>
    </component>

    <!-- Toast Notification -->
    <Transition name="toast">
        <div v-if="notesStore.toast.show" :class="['toast-notification', notesStore.toast.type]">
            <span class="toast-icon">
                {{ notesStore.toast.type === 'success' ? '✓' : notesStore.toast.type === 'error' ? '✗' : 'ℹ️' }}
            </span>
            <span>{{ notesStore.toast.message }}</span>
        </div>
    </Transition>

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

    <!-- Toolbar DEV (só em dev) -->
    <DeviceToolbar v-if="isDev" />
</template>

<style scoped>
/* Toast Notification */
.toast-notification {
    position: fixed;
    top: 24px;
    right: 24px;
    padding: 12px 20px;
    border-radius: 10px;
    font-size: 0.9rem;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 10px;
    z-index: 9999;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(8px);
}

.toast-notification.success {
    background: rgba(16, 185, 129, 0.9);
    color: white;
    border: 1px solid #10b981;
}

.toast-notification.error {
    background: rgba(239, 68, 68, 0.9);
    color: white;
    border: 1px solid #ef4444;
}

.toast-notification.info {
    background: rgba(56, 189, 248, 0.9);
    color: #0f172a;
    border: 1px solid #38bdf8;
}

.toast-enter-active, .toast-leave-active {
    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.toast-enter-from, .toast-leave-to {
    opacity: 0;
    transform: translateY(-20px) scale(0.95);
}
</style>