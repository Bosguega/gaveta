<template>
    <main class="app-shell">
        <header>
            <div class="header-content">
                <p>Memoria Auxiliar</p>
                <h1>Sua segunda mente com IA</h1>
                <p class="notes-count">{{ notesStore.notes.length }} notas salvas • {{ notesStore.stats.streak }} dias seguidos</p>
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
import { notesStore, navigateTo } from '../store/notesStore'
import { useErrorIcon } from '../composables/useErrorIcon'

const errorIcon = useErrorIcon(() => notesStore.error?.code)
</script>
