<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { open } from '@tauri-apps/plugin-dialog';
import {
    selectedPath,
    commonPaths,
    loadCommonPaths,
    startScan,
    isScanning,
    findInstallations,
    scanningForInstallations,
    foundPaths,
    savedPaths,
    loadSavedPaths
} from '@/composables/useComfyUIScan';

const dialogError = ref<string | null>(null);
const noInstallationsFound = ref(false);

onMounted(() => {
    loadCommonPaths();
    loadSavedPaths();
});

async function browseFolder() {
    dialogError.value = null;
    try {
        const selected = await open({
            directory: true,
            multiple: false,
            title: 'Selecione a pasta do ComfyUI'
        });

        if (selected && typeof selected === 'string') {
            selectedPath.value = selected;
        }
    } catch (error) {
        dialogError.value = error instanceof Error ? error.message : 'Não foi possível abrir o seletor de pastas';
    }
}

async function handleFindInstallations() {
    noInstallationsFound.value = false;
    await findInstallations();

    if (foundPaths.value.length === 0) {
        noInstallationsFound.value = true;
    }
}
</script>

<template>
    <div class="scan-controls">
        <button 
            class="find-btn" 
            @click="handleFindInstallations"
            :disabled="scanningForInstallations"
        >
            {{ scanningForInstallations ? '🔍 Buscando instalações...' : '🔍 Buscar Instalações Automaticamente' }}
        </button>

        <div class="divider">
            <span>ou selecione manualmente</span>
        </div>

        <div class="path-input-group">
            <input
                v-model="selectedPath"
                type="text"
                placeholder="Caminho da instalação do ComfyUI..."
                class="path-input"
                @keyup.enter="startScan"
            />
            <button class="browse-btn" @click="browseFolder">
                Procurar
            </button>
        </div>

        <div class="quick-paths" v-if="commonPaths.length > 0">
            <span class="quick-paths-label">Caminhos comuns:</span>
            <button
                v-for="path in commonPaths"
                :key="path"
                class="quick-path-btn"
                @click="selectedPath = path; startScan()"
            >
                {{ path }}
            </button>
        </div>

        <div v-if="dialogError" class="inline-error">
            <span>⚠️</span>
            <span>{{ dialogError }}</span>
        </div>

        <div v-if="noInstallationsFound" class="inline-info">
            <span>ℹ️</span>
            <span>Nenhuma instalação do ComfyUI encontrada automaticamente. Selecione o diretório manualmente.</span>
        </div>

        <div v-if="savedPaths.length > 0" class="saved-paths">
            <span class="saved-paths-label">Caminhos salvos:</span>
            <div class="saved-paths-list">
                <button
                    v-for="saved in savedPaths"
                    :key="saved.path"
                    class="saved-path-btn"
                    @click="selectedPath = saved.path; startScan()"
                >
                    {{ saved.path }} ({{ saved.path_type }})
                </button>
            </div>
        </div>

        <div v-if="foundPaths.length > 0" class="found-paths">
            <span class="found-paths-label">Instalações encontradas:</span>
            <div class="found-paths-list">
                <div v-for="found in foundPaths" :key="found.path" class="found-path-item">
                    <span class="path-type">{{ found.path_type }}</span>
                    <span class="path">{{ found.path }}</span>
                    <button class="use-path-btn" @click="selectedPath = found.path; startScan()">Usar</button>
                </div>
            </div>
        </div>

        <button
            class="scan-btn"
            @click="startScan"
            :disabled="!selectedPath || isScanning"
        >
            {{ isScanning ? 'Escaneando...' : 'Iniciar Scan' }}
        </button>
    </div>
</template>

<style scoped>
.inline-error {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    background: #fee2e2;
    border: 1px solid #fecaca;
    border-radius: 8px;
    color: #dc2626;
    font-size: 13px;
}

.inline-info {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    background: #eff6ff;
    border: 1px solid #bfdbfe;
    border-radius: 8px;
    color: #1d4ed8;
    font-size: 13px;
}

.scan-controls {
    display: flex;
    flex-direction: column;
    gap: 16px;
    margin-bottom: 28px;
    padding: 24px;
    border: 1px solid rgba(148, 163, 184, .22);
    border-radius: 20px;
    background: rgba(255, 255, 255, .78);
    box-shadow: 0 18px 48px rgba(15, 23, 42, .07);
    backdrop-filter: blur(12px);
}

.path-input-group {
    display: flex;
    gap: 8px;
}

.path-input {
    flex: 1;
    padding: 12px 16px;
    border: 1px solid #d9dfeb;
    border-radius: 12px;
    font-size: 14px;
    outline: none;
    background: #fff;
    transition: border-color .2s, box-shadow .2s;
}

.path-input:focus {
    border-color: #7c3aed;
    box-shadow: 0 0 0 4px rgba(124, 58, 237, .12);
}

.browse-btn {
    padding: 12px 20px;
    background: #f8fafc;
    border: 1px solid #d9dfeb;
    border-radius: 12px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    transition: all 0.2s;
}

.browse-btn:hover {
    background: #e5e7eb;
    border-color: #d1d5db;
}

.quick-paths {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
}

.quick-paths-label {
    font-size: 12px;
    color: #6b7280;
    font-weight: 500;
}

.quick-path-btn {
    padding: 6px 12px;
    background: #f5f3ff;
    border: 1px solid #ddd6fe;
    border-radius: 999px;
    color: #6d28d9;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s;
}

.quick-path-btn:hover {
    background: #fde68a;
    border-color: #f59e0b;
}

.scan-btn {
    padding: 14px 24px;
    background: linear-gradient(115deg, #7c3aed, #4f46e5);
    color: white;
    border: none;
    border-radius: 12px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 10px 22px rgba(79, 70, 229, .22);
    transition: all .2s;
}

.scan-btn:hover:not(:disabled) {
    background: linear-gradient(115deg, #6d28d9, #4338ca);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
}

.scan-btn:disabled {
    background: #9ca3af;
    cursor: not-allowed;
    transform: none;
}

.find-btn { align-self: flex-start; padding: 10px 14px; border: 0; border-radius: 10px; background: #ecfeff; color: #0e7490; font-weight: 700; cursor: pointer; }
.divider { display: flex; align-items: center; gap: 12px; color: #94a3b8; font-size: 12px; }
.divider::before, .divider::after { content: ''; height: 1px; flex: 1; background: #e2e8f0; }
@media (max-width: 640px) { .scan-controls { padding: 16px; } .path-input-group { flex-direction: column; } .browse-btn { width: 100%; } }
</style>
