<template>
    <main class="app-shell">
        <header>
            <div class="header-content">
                <div class="mobile-header-top">
                    <p>Memoria Auxiliar</p>
                    <button class="mobile-quick-btn" @click="notesStore.quickCaptureOpen = true" title="Captura Rápida">
                        ⚡ Captura
                    </button>
                </div>
                <h1>Sua segunda mente com IA</h1>
                <p class="notes-count">{{ notesStore.notes.length }} notas salvas • {{ notesStore.stats.streak }} dias seguidos</p>
                <div v-if="pendingRemindersCount > 0" class="mobile-reminders-badge" @click="navigateTo('search')">
                    ⏰ {{ pendingRemindersCount }} lembrete{{ pendingRemindersCount > 1 ? 's' : '' }} pendente{{ pendingRemindersCount > 1 ? 's' : '' }}
                </div>
            </div>

            <nav class="main-nav">
                <button :class="{ active: notesStore.activeView === 'search' }" @click="navigateTo('search')">
                    Pesquisar
                </button>
                <button :class="{ active: notesStore.activeView === 'add' }" @click="navigateTo('add')">
                    {{ notesStore.editingNote ? 'Editar Dica' : 'Incluir Dicas' }}
                </button>
                <button :class="{ active: notesStore.activeView === 'chat' }" @click="navigateTo('chat')">
                    Conversar (RAG)
                </button>
                <button :class="{ active: notesStore.activeView === 'insights' }" @click="navigateTo('insights')">
                    Insights
                </button>
                <button :class="{ active: notesStore.activeView === 'settings' }" @click="navigateTo('settings')">
                    ⚙️ Config
                </button>
            </nav>
        </header>

        <!-- Loading -->
        <div v-if="notesStore.loading" class="status-overlay">
            <div class="spinner"></div>
            <span>{{ notesStore.loadingMessage || 'Processando...' }}</span>
        </div>

        <!-- Error -->
        <div v-if="notesStore.error" :class="['error-banner', `error-${(notesStore.error.code || 'unknown').toLowerCase()}`]">
            <div class="error-content">
                <span class="error-icon">{{ errorIcon }}</span>
                <p>{{ notesStore.error.message }}</p>
            </div>
            <button v-if="notesStore.error.code === 'INVALID_API_KEY'" class="error-action" @click="notesStore.activeView = 'settings'">
                Ir para Configurações
            </button>
        </div>

        <slot />
    </main>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { notesStore, navigateTo } from '../store/notesStore'
import { useErrorIcon } from '../composables/useErrorIcon'

const errorIcon = useErrorIcon(() => notesStore.error?.code)

const pendingRemindersCount = computed(() => {
    const now = new Date()
    return notesStore.notes.filter(n => n.reminder_at && new Date(n.reminder_at) <= now).length
})
</script>

<style scoped>
.mobile-header-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.mobile-quick-btn {
    background: rgba(56, 189, 248, 0.15);
    border: 1px solid rgba(56, 189, 248, 0.3);
    color: var(--accent);
    padding: 3px 8px;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
}

.mobile-reminders-badge {
    margin-top: 6px;
    display: inline-block;
    background: rgba(239, 68, 68, 0.15);
    color: #f87171;
    border: 1px solid rgba(239, 68, 68, 0.3);
    padding: 3px 10px;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
}
</style>
