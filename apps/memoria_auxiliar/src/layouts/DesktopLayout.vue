<template>
    <div class="desktop-layout">
        <aside class="desktop-sidebar">
            <div class="desktop-sidebar-header">
                <div class="header-title-row">
                    <p>Memoria Auxiliar</p>
                    <button class="btn-quick-cap" @click="notesStore.quickCaptureOpen = true" title="Captura Rápida (Ctrl+Espaço)">
                        ⚡
                    </button>
                </div>
                <h3>Sua segunda mente com IA</h3>
                <p class="notes-count">{{ notesStore.notes.length }} notas salvas • {{ notesStore.stats.streak }} dias seguidos</p>
                <div v-if="pendingRemindersCount > 0" class="reminders-alert-pill" @click="navigateTo('search')">
                    ⏰ {{ pendingRemindersCount }} lembrete{{ pendingRemindersCount > 1 ? 's' : '' }} pendente{{ pendingRemindersCount > 1 ? 's' : '' }}
                </div>
            </div>

            <nav class="desktop-nav">
                <button :class="{ active: notesStore.activeView === 'search' }" @click="navigateTo('search')">
                    🔍 Pesquisar
                </button>
                <button :class="{ active: notesStore.activeView === 'add' }" @click="navigateTo('add')">
                    ✏️ {{ notesStore.editingNote ? 'Editar Dica' : 'Incluir Dicas' }}
                </button>
                <button :class="{ active: notesStore.activeView === 'chat' }" @click="navigateTo('chat')">
                    💬 Conversar (RAG)
                </button>
                <button :class="{ active: notesStore.activeView === 'insights' }" @click="navigateTo('insights')">
                    📊 Insights & Grafo
                </button>
                <button :class="{ active: notesStore.activeView === 'settings' }" @click="navigateTo('settings')">
                    ⚙️ Config & Temas
                </button>
            </nav>

            <div class="desktop-sidebar-footer">
                <button class="btn-quick-capture-full" @click="notesStore.quickCaptureOpen = true">
                    ⚡ Captura Rápida <kbd>Ctrl+Espaço</kbd>
                </button>
            </div>
        </aside>

        <main class="desktop-content">
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
                <button v-if="notesStore.error.code === 'INVALID_API_KEY'" class="error-action" @click="navigateTo('settings')">
                    Ir para Configurações
                </button>
            </div>

            <slot />
        </main>
    </div>
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
.desktop-layout {
    display: flex;
    min-height: 100vh;
}

.desktop-sidebar {
    width: 240px;
    flex-shrink: 0;
    background: rgba(15, 23, 42, 0.95);
    border-right: 1px solid rgba(255, 255, 255, 0.1);
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 24px;
}

.desktop-sidebar-header h3 {
    font-size: 1.1rem;
    font-weight: 700;
    color: #fff;
    margin: 4px 0;
}

.desktop-sidebar-header p {
    color: #94a3b8;
    font-size: 0.8rem;
}

.notes-count {
    margin-top: 4px;
}

.desktop-nav {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.desktop-nav button {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    background: transparent;
    border: none;
    border-radius: 8px;
    color: #94a3b8;
    cursor: pointer;
    transition: all 0.2s;
    font-size: 0.9rem;
    text-align: left;
    width: 100%;
}

.desktop-nav button:hover {
    background: rgba(255, 255, 255, 0.05);
    color: #e2e8f0;
}

.header-title-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.btn-quick-cap {
    background: rgba(56, 189, 248, 0.15);
    border: 1px solid rgba(56, 189, 248, 0.3);
    color: var(--accent);
    border-radius: 6px;
    padding: 2px 6px;
    font-size: 0.8rem;
    cursor: pointer;
    transition: all 0.2s;
}

.btn-quick-cap:hover {
    background: rgba(56, 189, 248, 0.3);
}

.reminders-alert-pill {
    margin-top: 8px;
    background: rgba(239, 68, 68, 0.15);
    color: #f87171;
    border: 1px solid rgba(239, 68, 68, 0.3);
    padding: 4px 8px;
    border-radius: 8px;
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    animation: pulse 2s infinite;
}

.desktop-sidebar-footer {
    margin-top: auto;
    padding-top: 16px;
}

.btn-quick-capture-full {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: rgba(56, 189, 248, 0.12);
    border: 1px solid rgba(56, 189, 248, 0.25);
    color: var(--accent);
    padding: 8px 12px;
    border-radius: 8px;
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
}

.btn-quick-capture-full:hover {
    background: rgba(56, 189, 248, 0.22);
    transform: translateY(-1px);
}

.desktop-content {
    flex: 1;
    padding: 24px 32px;
    overflow-y: auto;
    max-width: 960px;
}
</style>