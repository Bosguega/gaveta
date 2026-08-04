<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { open } from '@tauri-apps/plugin-dialog';
import type { UsefulPath } from '@/types';
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
    loadSavedPaths,
    usefulPaths,
    loadUsefulPaths,
    persistUsefulPaths,
    openFolder,
    usefulPathsError,
    isSavingUsefulPaths,
    showToast
} from '@/composables/useComfyUIScan';

const dialogError = ref<string | null>(null);
const noInstallationsFound = ref(false);

// Modal de edição/adicionar atalho
const showShortcutModal = ref(false);
const editingShortcut = ref<UsefulPath | null>(null);
const shortcutLabel = ref('');
const shortcutPath = ref('');

onMounted(async () => {
    loadCommonPaths();
    loadSavedPaths();
    loadUsefulPaths();

    // Detecção automática de instalações ao abrir o app
    if (!selectedPath.value) {
        await handleFindInstallations();
        if (foundPaths.value.length > 0 && !selectedPath.value) {
            selectedPath.value = foundPaths.value[0].path;
        }
    }
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

function openAddShortcutModal() {
    editingShortcut.value = null;
    shortcutLabel.value = '';
    shortcutPath.value = '';
    showShortcutModal.value = true;
}

function openEditShortcutModal(shortcut: UsefulPath) {
    editingShortcut.value = { ...shortcut };
    shortcutLabel.value = shortcut.label;
    shortcutPath.value = shortcut.path;
    showShortcutModal.value = true;
}

async function browseShortcutPath() {
    try {
        const selected = await open({
            directory: true,
            multiple: false,
            title: 'Selecione a pasta do atalho'
        });

        if (selected && typeof selected === 'string') {
            shortcutPath.value = selected;
        }
    } catch (error) {
        dialogError.value = error instanceof Error ? error.message : 'Não foi possível abrir o seletor de pastas';
    }
}

async function saveShortcut() {
    if (!shortcutLabel.value.trim() || !shortcutPath.value.trim()) {
        dialogError.value = 'Preencha o nome e o caminho do atalho.';
        return;
    }

    if (editingShortcut.value) {
        const index = usefulPaths.value.findIndex(p => p.id === editingShortcut.value!.id);
        if (index !== -1) {
            usefulPaths.value[index] = {
                ...editingShortcut.value,
                label: shortcutLabel.value.trim(),
                path: shortcutPath.value.trim()
            };
        }
    } else {
        usefulPaths.value.push({
            id: 'custom:' + Date.now().toString(),
            label: shortcutLabel.value.trim(),
            path: shortcutPath.value.trim(),
            builtin: false,
            exists: true
        });
    }

    await persistUsefulPaths();
    showShortcutModal.value = false;
    showToast('success', editingShortcut.value ? 'Atalho atualizado com sucesso.' : 'Atalho adicionado com sucesso.');
}

function onShortcutContextMenu(event: MouseEvent, shortcut: UsefulPath) {
    event.preventDefault();
    openEditShortcutModal(shortcut);
}

async function removeShortcut(shortcut: UsefulPath) {
    if (shortcut.builtin) return;
    const confirmed = window.confirm(`Tem certeza que deseja excluir o atalho "${shortcut.label}"?`);
    if (!confirmed) return;
    usefulPaths.value = usefulPaths.value.filter(p => p.id !== shortcut.id);
    await persistUsefulPaths();
    showShortcutModal.value = false;
    showToast('success', `Atalho "${shortcut.label}" excluído.`);
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

        <div class="useful-paths" v-if="usefulPaths.length > 0">
            <div class="useful-paths-header">
                <span class="useful-paths-label">Atalhos Úteis</span>
                <button class="add-shortcut-btn" @click="openAddShortcutModal" title="Adicionar atalho">
                    +
                </button>
            </div>
            <div class="useful-paths-list">
                <button
                    v-for="shortcut in usefulPaths"
                    :key="shortcut.id"
                    class="useful-path-btn"
                    :class="{ 'missing-path': !shortcut.exists }"
                    @click="openFolder(shortcut.path)"
                    @contextmenu.prevent="onShortcutContextMenu($event, shortcut)"
                    :title="shortcut.path + (shortcut.exists ? '' : ' (pasta não encontrada)') + ' • clique direito para editar'"
                >
                    <span class="useful-path-icon">{{ shortcut.exists ? '📁' : '⚠️' }}</span>
                    <span class="useful-path-label">{{ shortcut.label }}</span>
                </button>
            </div>
            <p class="useful-paths-hint">Clique para abrir a pasta • Clique direito para editar</p>
        </div>

        <div v-if="usefulPathsError" class="inline-error">
            <span>⚠️</span>
            <span>{{ usefulPathsError }}</span>
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

        <!-- Modal de adicionar/editar atalho -->
        <div v-if="showShortcutModal" class="modal-overlay" @click.self="showShortcutModal = false">
            <div class="modal">
                <h3>{{ editingShortcut ? 'Editar Atalho' : 'Novo Atalho' }}</h3>
                <div class="modal-field">
                    <label>Nome</label>
                    <input
                        v-model="shortcutLabel"
                        type="text"
                        placeholder="Ex: Modelos, Workflows, Output..."
                        class="modal-input"
                    />
                </div>
                <div class="modal-field">
                    <label>Caminho</label>
                    <div class="modal-path-group">
                        <input
                            v-model="shortcutPath"
                            type="text"
                            placeholder="Caminho da pasta..."
                            class="modal-input"
                        />
                        <button class="modal-browse-btn" @click="browseShortcutPath">Procurar</button>
                    </div>
                </div>
                <div class="modal-actions">
                    <button
                        v-if="editingShortcut && !editingShortcut.builtin"
                        class="modal-delete-btn"
                        @click="removeShortcut(editingShortcut)"
                        :disabled="isSavingUsefulPaths"
                    >
                        Excluir Atalho
                    </button>
                    <div class="modal-actions-spacer"></div>
                    <button class="modal-cancel-btn" @click="showShortcutModal = false">Cancelar</button>
                    <button class="modal-save-btn" @click="saveShortcut" :disabled="isSavingUsefulPaths">
                        {{ isSavingUsefulPaths ? 'Salvando...' : 'Salvar' }}
                    </button>
                </div>
            </div>
        </div>
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

/* === Atalhos Úteis === */
.useful-paths {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 14px 16px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 14px;
}

.useful-paths-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
}

.useful-paths-label {
    font-size: 13px;
    color: #334155;
    font-weight: 700;
    letter-spacing: .02em;
}

.add-shortcut-btn {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #7c3aed;
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 18px;
    font-weight: 700;
    line-height: 1;
    cursor: pointer;
    transition: all .2s;
}

.add-shortcut-btn:hover {
    background: #6d28d9;
    transform: scale(1.05);
}

.useful-paths-list {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
}

.useful-path-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    color: #1e293b;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all .2s;
    user-select: none;
}

.useful-path-btn:hover {
    background: #f5f3ff;
    border-color: #c4b5fd;
    color: #6d28d9;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(124, 58, 237, .12);
}

.useful-path-btn.missing-path {
    background: #fef2f2;
    border-color: #fecaca;
    color: #b91c1c;
}

.useful-path-btn.missing-path:hover {
    background: #fee2e2;
    border-color: #fca5a5;
    color: #991b1b;
}

.modal-actions-spacer {
    flex: 1;
}

.modal-delete-btn {
    padding: 10px 18px;
    background: #dc2626;
    color: white;
    border: none;
    border-radius: 10px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 600;
    transition: all .2s;
}

.modal-delete-btn:hover:not(:disabled) {
    background: #b91c1c;
}

.modal-delete-btn:disabled {
    background: #9ca3af;
    cursor: not-allowed;
}

.useful-path-icon {
    font-size: 14px;
}

.useful-paths-hint {
    margin: 0;
    font-size: 11px;
    color: #94a3b8;
}

/* === Modal === */
.modal-overlay {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(15, 23, 42, .5);
    z-index: 1000;
    backdrop-filter: blur(4px);
}

.modal {
    width: 100%;
    max-width: 480px;
    padding: 24px;
    background: white;
    border-radius: 16px;
    box-shadow: 0 24px 64px rgba(15, 23, 42, .25);
}

.modal h3 {
    margin: 0 0 20px;
    font-size: 18px;
    font-weight: 700;
    color: #1e293b;
}

.modal-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 16px;
}

.modal-field label {
    font-size: 12px;
    font-weight: 600;
    color: #475569;
}

.modal-input {
    padding: 10px 14px;
    border: 1px solid #d9dfeb;
    border-radius: 10px;
    font-size: 14px;
    outline: none;
    transition: border-color .2s, box-shadow .2s;
}

.modal-input:focus {
    border-color: #7c3aed;
    box-shadow: 0 0 0 4px rgba(124, 58, 237, .12);
}

.modal-path-group {
    display: flex;
    gap: 8px;
}

.modal-path-group .modal-input {
    flex: 1;
}

.modal-browse-btn {
    padding: 10px 16px;
    background: #f8fafc;
    border: 1px solid #d9dfeb;
    border-radius: 10px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
    white-space: nowrap;
    transition: all .2s;
}

.modal-browse-btn:hover {
    background: #e5e7eb;
}

.modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 20px;
}

.modal-cancel-btn {
    padding: 10px 18px;
    background: #f8fafc;
    border: 1px solid #d9dfeb;
    border-radius: 10px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    transition: all .2s;
}

.modal-cancel-btn:hover {
    background: #e5e7eb;
}

.modal-save-btn {
    padding: 10px 18px;
    background: #7c3aed;
    color: white;
    border: none;
    border-radius: 10px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 600;
    transition: all .2s;
}

.modal-save-btn:hover:not(:disabled) {
    background: #6d28d9;
}

.modal-save-btn:disabled {
    background: #9ca3af;
    cursor: not-allowed;
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