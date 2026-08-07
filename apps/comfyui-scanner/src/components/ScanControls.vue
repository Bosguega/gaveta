<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { open } from '@tauri-apps/plugin-dialog';
import type { UsefulPath } from '@/types';
import {
    selectedPath,
    startScan,
    isScanning,
    findInstallations,
    scanningForInstallations,
    foundPaths,
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
    dialogError.value = null;
    await findInstallations();

    if (foundPaths.value.length === 0) {
        noInstallationsFound.value = true;
    } else {
        // Preenche automaticamente com a primeira instalação encontrada
        if (!selectedPath.value) {
            selectedPath.value = foundPaths.value[0].path;
        }
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
        <div class="path-row">
            <input
                v-model="selectedPath"
                type="text"
                placeholder="Caminho da instalação do ComfyUI..."
                class="path-input"
                @keyup.enter="startScan"
            />
            <button class="browse-btn" @click="browseFolder" title="Procurar pasta">
                📂
            </button>
            <button
                class="find-btn"
                @click="handleFindInstallations"
                :disabled="scanningForInstallations"
                title="Detectar instalações automaticamente"
            >
                {{ scanningForInstallations ? '🔍 Buscando...' : '🔍 Detectar' }}
            </button>
            <button
                class="scan-btn"
                @click="startScan"
                :disabled="!selectedPath || isScanning"
            >
                {{ isScanning ? 'Escaneando...' : 'Escanear' }}
            </button>
        </div>

        <div v-if="dialogError" class="inline-error">
            <span>⚠️</span>
            <span>{{ dialogError }}</span>
        </div>

        <div v-if="noInstallationsFound" class="inline-info">
            <span>ℹ️</span>
            <span>Nenhuma instalação encontrada automaticamente. Selecione o diretório manualmente.</span>
        </div>

        <div v-if="usefulPaths.length > 0" class="useful-paths">
            <div class="useful-paths-header">
                <span class="useful-paths-label">Atalhos Úteis</span>
                <button class="add-shortcut-btn" @click="openAddShortcutModal" title="Adicionar atalho">+</button>
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
.scan-controls {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-bottom: 28px;
    padding: 20px 24px;
    border: 1px solid rgba(148, 163, 184, .22);
    border-radius: 20px;
    background: rgba(255, 255, 255, .78);
    box-shadow: 0 18px 48px rgba(15, 23, 42, .07);
    backdrop-filter: blur(12px);
}

/* === Linha principal === */
.path-row {
    display: flex;
    gap: 8px;
    align-items: center;
}

.path-input {
    flex: 1;
    padding: 11px 16px;
    border: 1px solid #d9dfeb;
    border-radius: 12px;
    font-size: 14px;
    outline: none;
    background: #fff;
    transition: border-color .2s, box-shadow .2s;
    min-width: 0;
}

.path-input:focus {
    border-color: #7c3aed;
    box-shadow: 0 0 0 4px rgba(124, 58, 237, .12);
}

.browse-btn {
    flex-shrink: 0;
    padding: 11px 14px;
    background: #f8fafc;
    border: 1px solid #d9dfeb;
    border-radius: 12px;
    cursor: pointer;
    font-size: 16px;
    transition: all .2s;
}

.browse-btn:hover {
    background: #e5e7eb;
    border-color: #d1d5db;
}

.find-btn {
    flex-shrink: 0;
    padding: 11px 14px;
    background: #ecfeff;
    border: 1px solid #a5f3fc;
    border-radius: 12px;
    color: #0e7490;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    white-space: nowrap;
    transition: all .2s;
}

.find-btn:hover:not(:disabled) {
    background: #cffafe;
    border-color: #67e8f9;
}

.find-btn:disabled {
    opacity: .65;
    cursor: wait;
}

.scan-btn {
    flex-shrink: 0;
    padding: 11px 22px;
    background: linear-gradient(115deg, #7c3aed, #4f46e5);
    color: white;
    border: none;
    border-radius: 12px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
    box-shadow: 0 6px 18px rgba(79, 70, 229, .22);
    transition: all .2s;
}

.scan-btn:hover:not(:disabled) {
    background: linear-gradient(115deg, #6d28d9, #4338ca);
    transform: translateY(-1px);
    box-shadow: 0 8px 22px rgba(99, 102, 241, .3);
}

.scan-btn:disabled {
    background: #9ca3af;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
}

/* === Mensagens inline === */
.inline-error {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    background: #fee2e2;
    border: 1px solid #fecaca;
    border-radius: 10px;
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
    border-radius: 10px;
    color: #1d4ed8;
    font-size: 13px;
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
    font-size: 12px;
    color: #475569;
    font-weight: 700;
    letter-spacing: .04em;
    text-transform: uppercase;
}

.add-shortcut-btn {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #7c3aed;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 16px;
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
    gap: 6px;
}

.useful-path-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 7px 12px;
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

.useful-path-icon { font-size: 13px; }

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

.modal-actions-spacer { flex: 1; }

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

@media (max-width: 640px) {
    .scan-controls { padding: 16px; }
    .path-row { flex-wrap: wrap; }
    .path-input { flex-basis: 100%; }
    .find-btn, .scan-btn { flex: 1; }
}
</style>