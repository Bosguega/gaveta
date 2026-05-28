<template>
    <div class="desktop-layout">
        <aside class="desktop-sidebar">
            <div class="desktop-sidebar-header">
                <p>Memoria Auxiliar</p>
                <h3>Sua segunda mente com IA</h3>
                <p class="notes-count">{{ notesStore.notes.length }} notas salvas • {{ notesStore.stats.streak }} dias seguidos</p>
            </div>

            <nav class="desktop-nav">
                <button :class="{ active: notesStore.activeView === 'search' }" @click="notesStore.activeView = 'search'">
                    🔍 Pesquisar
                </button>
                <button :class="{ active: notesStore.activeView === 'add' }" @click="notesStore.activeView = 'add'">
                    ✏️ {{ notesStore.editingNote ? 'Editar Dica' : 'Incluir Dicas' }}
                </button>
                <button :class="{ active: notesStore.activeView === 'chat' }" @click="notesStore.activeView = 'chat'">
                    💬 Conversar (RAG)
                </button>
                <button :class="{ active: notesStore.activeView === 'insights' }" @click="notesStore.activeView = 'insights'">
                    📊 Insights
                </button>
                <button :class="{ active: notesStore.activeView === 'settings' }" @click="notesStore.activeView = 'settings'">
                    ⚙️ Config
                </button>
            </nav>
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
                <button v-if="notesStore.error.code === 'INVALID_API_KEY'" class="error-action" @click="notesStore.activeView = 'settings'">
                    Ir para Configurações
                </button>
            </div>

            <slot />
        </main>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { notesStore } from '../store/notesStore'

const errorIcon = computed(() => {
    const code = notesStore.error?.code
    if (code === 'INVALID_API_KEY') return '🔑'
    if (code === 'RATE_LIMIT_EXCEEDED') return '⏳'
    if (code === 'NETWORK_ERROR' || code === 'TIMEOUT') return '🌐'
    if (code === 'SERVICE_UNAVAILABLE' || code === 'SERVER_ERROR') return '🔧'
    return '⚠️'
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

.desktop-nav button.active {
    background: rgba(59, 130, 246, 0.1);
    color: #60a5fa;
}

.desktop-content {
    flex: 1;
    padding: 24px 32px;
    overflow-y: auto;
    max-width: 960px;
}
</style>