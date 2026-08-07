<script setup lang="ts">
import { computed, ref, onMounted } from 'vue';
import type { ScannedItem, SafetensorsMetadata } from '@/types';
import {
    scanResult,
    categories,
    totalItems,
    totalSize,
    exportFormat,
    handleExport,
    resetScan,
    searchQuery,
    selectedCategory,
    sortBy,
    filteredItems,
    exportStatus,
    isExporting,
    renameModel,
    deleteModel,
    openFolder,
    startScan,
    showToast,
    duplicateGroups,
    isSearchingDuplicates,
    loadSafetensorsMetadata,
    safetensorsMetadataCache
} from '@/composables/useComfyUIScan';

const expandedCategories = ref<Set<string>>(new Set());
const showRenameModal = ref(false);
const renameTarget = ref<ScannedItem | null>(null);
const renameValue = ref('');
const actionError = ref<string | null>(null);
const showDeleteConfirm = ref(false);
const deleteTarget = ref<ScannedItem | null>(null);
const showDuplicatesModal = ref(false);

// Metadados carregados para os cards visíveis
const loadedMetadata = ref<Record<string, SafetensorsMetadata>>({});

function toggleCategory(category: string) {
    if (expandedCategories.value.has(category)) {
        expandedCategories.value.delete(category);
    } else {
        expandedCategories.value.add(category);
        // Carrega metadados dos arquivos .safetensors da categoria quando expandida
        loadMetadataForCategory(category);
    }
}

async function loadMetadataForCategory(category: string) {
    const items = getItemsByCategory(category);
    for (const item of items) {
        if (item.file_type.toLowerCase() === 'safetensors' && !loadedMetadata.value[item.path]) {
            const meta = await loadSafetensorsMetadata(item.path);
            if (meta) {
                loadedMetadata.value[item.path] = meta;
            }
        }
    }
}

function getItemsByCategory(category: string): ScannedItem[] {
    return filteredItems.value.filter(item => item.category === category);
}

function formatSize(size: number): string {
    if (size >= 1024) {
        return `${(size / 1024).toFixed(2)} GB`;
    }
    if (size >= 1) {
        return `${size.toFixed(2)} MB`;
    }
    const kb = size * 1024;
    if (kb < 0.1) {
        return '< 0.1 KB';
    }
    return `${kb.toFixed(1)} KB`;
}

function getFileIcon(fileType: string): string {
    const icons: Record<string, string> = {
        'safetensors': '🔐',
        'ckpt': '📦',
        'pt': '🧠',
        'pth': '🔧',
        'bin': '⚙️',
        'onnx': '🔌',
        'json': '📋',
        'png': '🖼️',
        'jpg': '📷',
        'jpeg': '📷',
        'folder': '📁',
        'py': '🐍',
    };
    return icons[fileType.toLowerCase()] || '📄';
}

function openRenameModal(item: ScannedItem) {
    renameTarget.value = item;
    renameValue.value = item.name;
    actionError.value = null;
    showRenameModal.value = true;
}

async function confirmRename() {
    if (!renameTarget.value || !renameValue.value.trim()) return;
    try {
        await renameModel(renameTarget.value.path, renameValue.value.trim());
        showRenameModal.value = false;
        showToast('success', `Arquivo renomeado para "${renameValue.value.trim()}".`);
        await startScan();
    } catch (error) {
        actionError.value = error instanceof Error ? error.message : 'Erro ao renomear arquivo';
        showToast('error', actionError.value);
    }
}

function openDeleteConfirm(item: ScannedItem) {
    deleteTarget.value = item;
    actionError.value = null;
    showDeleteConfirm.value = true;
}

async function confirmDelete() {
    if (!deleteTarget.value) return;
    try {
        await deleteModel(deleteTarget.value.path);
        showDeleteConfirm.value = false;
        showToast('success', `Arquivo "${deleteTarget.value.name}" excluído.`);
        await startScan();
    } catch (error) {
        actionError.value = error instanceof Error ? error.message : 'Erro ao excluir arquivo';
        showToast('error', actionError.value);
    }
}

function copyTriggerWord(word: string) {
    navigator.clipboard.writeText(word);
    showToast('success', `Trigger word "${word}" copiada!`);
}

// Cálculo da distribuição de disco por categoria
const categoryDiskBreakdown = computed(() => {
    if (!scanResult.value?.items || totalSize.value === 0) return [];
    
    const totals: Record<string, number> = {};
    for (const item of scanResult.value.items) {
        totals[item.category] = (totals[item.category] || 0) + item.size_mb;
    }

    const palette = [
        '#7c3aed', '#3b82f6', '#10b981', '#f59e0b', '#ec4899',
        '#8b5cf6', '#06b6d4', '#84cc16', '#f97316', '#64748b'
    ];

    return Object.entries(totals)
        .map(([name, size], i) => ({
            name,
            size,
            percent: (size / totalSize.value) * 100,
            color: palette[i % palette.length]
        }))
        .sort((a, b) => b.size - a.size);
});

// Ignorar grupos marcados como falso positivo
const ignoredGroupKeys = ref<Set<string>>(new Set());

function getGroupKey(group: { size_mb: number; items: ScannedItem[] }): string {
    return `${group.size_mb}_${group.items.map(i => i.path).sort().join('|')}`;
}

function ignoreDuplicateGroup(group: { size_mb: number; items: ScannedItem[] }) {
    const key = getGroupKey(group);
    ignoredGroupKeys.value.add(key);
    showToast('info', 'Grupo de duplicatas ignorado.');
}

function areNamesIdentical(items: ScannedItem[]): boolean {
    if (items.length <= 1) return true;
    const firstName = items[0].name.toLowerCase();
    return items.every(item => item.name.toLowerCase() === firstName);
}

const activeDuplicateGroups = computed(() => {
    return duplicateGroups.value.filter(group => !ignoredGroupKeys.value.has(getGroupKey(group)));
});

// Estatísticas de duplicatas
const totalWastedMb = computed(() => {
    return activeDuplicateGroups.value.reduce((sum, group) => {
        return sum + (group.size_mb * (group.items.length - 1));
    }, 0);
});
</script>

<template>
    <div class="results-list" v-if="scanResult && scanResult.success">
        <!-- Cabeçalho -->
        <div class="results-header">
            <div class="header-left">
                <h2>Resultados do Scan</h2>
                <div class="stats">
                    <span class="stat">📁 {{ totalItems }} itens</span>
                    <span class="stat">💾 {{ formatSize(totalSize) }}</span>
                </div>
            </div>
            <div class="header-actions">
                <input v-model="searchQuery" class="search-input" type="search" placeholder="Buscar itens..." />
                <select v-model="sortBy" class="export-select" aria-label="Ordenação">
                    <option value="name">Nome</option>
                    <option value="size-desc">Maior tamanho</option>
                    <option value="size-asc">Menor tamanho</option>
                </select>
                <select v-model="exportFormat" class="export-select">
                    <option value="json">JSON</option>
                    <option value="csv">CSV</option>
                    <option value="html">HTML</option>
                    <option value="md">Markdown</option>
                    <option value="txt">TXT</option>
                </select>
                <button class="export-btn" @click="handleExport" :disabled="isExporting">
                    {{ isExporting ? 'Exportando...' : 'Exportar' }}
                </button>
                <button class="reset-btn" @click="resetScan">
                    Novo Scan
                </button>
            </div>
        </div>

        <p v-if="exportStatus" class="export-status">{{ exportStatus }}</p>

        <!-- 📊 Gráfico de Distribuição do Disco -->
        <div class="disk-breakdown-card" v-if="categoryDiskBreakdown.length > 0">
            <div class="disk-breakdown-header">
                <span class="disk-breakdown-title">📊 Distribuição de Espaço em Disco</span>
                <span class="disk-breakdown-total">Total: {{ formatSize(totalSize) }}</span>
            </div>
            <div class="disk-bar">
                <div
                    v-for="cat in categoryDiskBreakdown"
                    :key="cat.name"
                    class="disk-bar-segment"
                    :style="{ width: cat.percent + '%', backgroundColor: cat.color }"
                    :title="`${cat.name}: ${formatSize(cat.size)} (${cat.percent.toFixed(1)}%)`"
                ></div>
            </div>
            <div class="disk-legend">
                <div v-for="cat in categoryDiskBreakdown.slice(0, 6)" :key="cat.name" class="legend-item">
                    <span class="legend-dot" :style="{ backgroundColor: cat.color }"></span>
                    <span class="legend-name">{{ cat.name }}</span>
                    <span class="legend-size">{{ formatSize(cat.size) }} ({{ cat.percent.toFixed(1) }}%)</span>
                </div>
            </div>
        </div>

        <!-- ⚡ Alerta de Modelos Duplicados -->
        <div v-if="activeDuplicateGroups.length > 0" class="duplicate-alert-banner">
            <div class="duplicate-alert-info">
                <span class="duplicate-icon">⚡</span>
                <div>
                    <strong>{{ activeDuplicateGroups.length }} grupo(s) de modelos duplicados encontrados!</strong>
                    <p>Espaço desperdiçado aproximado: <strong>{{ formatSize(totalWastedMb) }}</strong></p>
                </div>
            </div>
            <button class="manage-duplicates-btn" @click="showDuplicatesModal = true">
                Gerenciar Duplicatas
            </button>
        </div>

        <!-- Resumo por categorias -->
        <div class="categories-summary">
            <button class="category-summary-item" :class="{ active: !selectedCategory }" @click="selectedCategory = null">
                <span class="category-name">Todas</span>
                <span class="category-count">{{ totalItems }}</span>
            </button>
            <div
                v-for="category in categories"
                :key="category.name"
                class="category-summary-item"
                :class="{ active: selectedCategory === category.name }"
                @click="selectedCategory = selectedCategory === category.name ? null : category.name"
            >
                <span class="category-name">{{ category.name }}</span>
                <span class="category-count">{{ category.count }}</span>
            </div>
        </div>

        <!-- Lista por seções -->
        <div class="results-content">
            <div
                v-for="category in categories.filter(category => !selectedCategory || category.name === selectedCategory)"
                :key="category.name"
                class="category-section"
            >
                <div
                    class="category-header"
                    @click="toggleCategory(category.name)"
                >
                    <span class="expand-icon">
                        {{ expandedCategories.has(category.name) ? '▼' : '▶' }}
                    </span>
                    <span class="category-title">{{ category.name }}</span>
                    <span class="category-badge">{{ category.count }}</span>
                </div>

                <div v-if="expandedCategories.has(category.name)" class="category-items">
                    <div
                        v-for="item in getItemsByCategory(category.name)"
                        :key="item.path"
                        class="item-card"
                    >
                        <div class="item-icon">
                            {{ getFileIcon(item.file_type) }}
                        </div>
                        <div class="item-info">
                            <div class="item-name-row">
                                <span class="item-name">{{ item.name }}</span>
                                <span v-if="loadedMetadata[item.path]?.base_model" class="base-model-badge">
                                    {{ loadedMetadata[item.path].base_model }}
                                </span>
                            </div>
                            <div class="item-path">{{ item.path }}</div>

                            <!-- Metadados de Safetensors (Trigger Words) -->
                            <div v-if="loadedMetadata[item.path]?.trigger_words?.length" class="trigger-words-list">
                                <span class="trigger-label">Trigger words:</span>
                                <button
                                    v-for="word in loadedMetadata[item.path].trigger_words.slice(0, 6)"
                                    :key="word"
                                    class="trigger-tag"
                                    @click="copyTriggerWord(word)"
                                    title="Clique para copiar palavra de ativação"
                                >
                                    {{ word }} 📋
                                </button>
                            </div>

                            <div class="item-meta">
                                <span class="item-size">{{ formatSize(item.size_mb) }}</span>
                                <span class="item-type">{{ item.file_type }}</span>
                            </div>
                        </div>
                        <div class="item-actions">
                            <button class="item-action-btn" title="Abrir pasta" @click="openFolder(item.path)">📂</button>
                            <button class="item-action-btn" title="Renomear" @click="openRenameModal(item)">✏️</button>
                            <button class="item-action-btn danger" title="Excluir" @click="openDeleteConfirm(item)">🗑️</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Modal de Gerenciamento de Duplicatas -->
        <div v-if="showDuplicatesModal" class="modal-overlay" @click.self="showDuplicatesModal = false">
            <div class="modal duplicates-modal">
                <h3>⚡ Gerenciador de Duplicatas</h3>
                <p class="modal-subtitle">Arquivos com mesmo conteúdo e tamanho em locais diferentes:</p>
                
                <div class="duplicate-groups-list">
                    <div v-if="activeDuplicateGroups.length === 0" class="empty-state">
                        Nenhum grupo de duplicatas ativo. Todos foram resolvidos ou ignorados.
                    </div>
                    <div v-for="(group, idx) in activeDuplicateGroups" :key="getGroupKey(group)" class="duplicate-group-card">
                        <div class="duplicate-group-header">
                            <div class="duplicate-header-left">
                                <span>Grupo #{{ idx + 1 }} • Tamanho cada: {{ formatSize(group.size_mb) }}</span>
                                <span v-if="areNamesIdentical(group.items)" class="confidence-badge exact">
                                    🟢 Cópia Exata (Mesmo Nome)
                                </span>
                                <span v-else class="confidence-badge diff">
                                    ⚠️ Nomes Diferentes (Verifique)
                                </span>
                            </div>
                            <div class="duplicate-header-right">
                                <span class="wasted-tag">Desperdício: {{ formatSize(group.size_mb * (group.items.length - 1)) }}</span>
                                <button class="ignore-group-btn" @click="ignoreDuplicateGroup(group)" title="Marcar como falso positivo e ignorar">
                                    🚫 Ignorar
                                </button>
                            </div>
                        </div>
                        <div class="duplicate-items">
                            <div v-for="item in group.items" :key="item.path" class="duplicate-item-row">
                                <div class="duplicate-item-info">
                                    <strong>{{ item.name }}</strong>
                                    <small>{{ item.path }}</small>
                                </div>
                                <div class="duplicate-item-actions">
                                    <button class="item-action-btn" title="Abrir pasta" @click="openFolder(item.path)">📂</button>
                                    <button class="item-action-btn danger" title="Excluir esta cópia" @click="openDeleteConfirm(item)">🗑️ Excluir</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="modal-actions">
                    <button class="modal-cancel-btn" @click="showDuplicatesModal = false">Fechar</button>
                </div>
            </div>
        </div>

        <!-- Modal de renomear -->
        <div v-if="showRenameModal" class="modal-overlay" @click.self="showRenameModal = false">
            <div class="modal">
                <h3>Renomear Arquivo</h3>
                <p class="modal-path">{{ renameTarget?.path }}</p>
                <input v-model="renameValue" type="text" class="modal-input" @keyup.enter="confirmRename" />
                <p v-if="actionError" class="modal-error">{{ actionError }}</p>
                <div class="modal-actions">
                    <button class="modal-cancel-btn" @click="showRenameModal = false">Cancelar</button>
                    <button class="modal-save-btn" @click="confirmRename">Renomear</button>
                </div>
            </div>
        </div>

        <!-- Modal de confirmação de exclusão -->
        <!-- Modal de confirmação de exclusão -->
        <div v-if="showDeleteConfirm" class="modal-overlay" @click.self="showDeleteConfirm = false">
            <div class="modal">
                <h3>Excluir Arquivo</h3>
                <p>Tem certeza que deseja excluir <strong>{{ deleteTarget?.name }}</strong>?</p>
                <p class="modal-path">{{ deleteTarget?.path }}</p>
                <p v-if="actionError" class="modal-error">{{ actionError }}</p>
                <div class="modal-actions">
                    <button class="modal-cancel-btn" @click="showDeleteConfirm = false">Cancelar</button>
                    <button class="modal-delete-btn" @click="confirmDelete">Excluir</button>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
/* 📊 Gráfico de Distribuição do Disco */
.disk-breakdown-card {
    padding: 16px;
    background: white;
    border-radius: 14px;
    border: 1px solid rgba(148, 163, 184, 0.2);
    box-shadow: 0 4px 12px rgba(15, 23, 42, 0.04);
}

.disk-breakdown-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
}

.disk-breakdown-title {
    font-size: 13px;
    font-weight: 700;
    color: #334155;
}

.disk-breakdown-total {
    font-size: 12px;
    color: #64748b;
    font-weight: 600;
}

.disk-bar {
    display: flex;
    height: 12px;
    border-radius: 999px;
    overflow: hidden;
    background: #e2e8f0;
    margin-bottom: 12px;
}

.disk-bar-segment {
    height: 100%;
    transition: width 0.3s ease;
}

.disk-legend {
    display: flex;
    flex-wrap: wrap;
    gap: 12px 18px;
}

.legend-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
}

.legend-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
}

.legend-name {
    color: #475569;
    font-weight: 500;
}

.legend-size {
    color: #94a3b8;
}

/* ⚡ Alerta de Duplicatas */
.duplicate-alert-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 14px 18px;
    background: linear-gradient(115deg, #fff7ed, #ffedd5);
    border: 1px solid #fed7aa;
    border-radius: 14px;
    color: #c2410c;
}

.duplicate-alert-info {
    display: flex;
    align-items: center;
    gap: 12px;
}

.duplicate-icon {
    font-size: 24px;
}

.duplicate-alert-info p {
    margin: 2px 0 0;
    font-size: 13px;
    color: #9a3412;
}

.manage-duplicates-btn {
    padding: 8px 16px;
    background: #ea580c;
    color: white;
    border: none;
    border-radius: 10px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.2s;
}

.manage-duplicates-btn:hover {
    background: #c2410c;
}

/* Modal de Duplicatas */
.duplicates-modal {
    max-width: 680px;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
}

.modal-subtitle {
    font-size: 13px;
    color: #64748b;
    margin: 0 0 16px;
}

.duplicate-groups-list {
    display: flex;
    flex-direction: column;
    gap: 14px;
    overflow-y: auto;
    max-height: 50vh;
    padding-right: 4px;
}

.duplicate-group-card {
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    background: #f8fafc;
    overflow: hidden;
}

.duplicate-group-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 14px;
    background: #f1f5f9;
    font-size: 12px;
    font-weight: 600;
    color: #334155;
    border-bottom: 1px solid #e2e8f0;
    gap: 10px;
    flex-wrap: wrap;
}

.duplicate-header-left, .duplicate-header-right {
    display: flex;
    align-items: center;
    gap: 8px;
}

.confidence-badge {
    padding: 2px 8px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 600;
}

.confidence-badge.exact {
    background: #dcfce7;
    color: #15803d;
    border: 1px solid #bbf7d0;
}

.confidence-badge.diff {
    background: #fef3c7;
    color: #b45309;
    border: 1px solid #fde68a;
}

.ignore-group-btn {
    padding: 4px 10px;
    background: #f1f5f9;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    color: #475569;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
}

.ignore-group-btn:hover {
    background: #e2e8f0;
    color: #1e293b;
}

.wasted-tag {
    color: #dc2626;
    background: #fee2e2;
    padding: 2px 8px;
    border-radius: 6px;
}

.duplicate-items {
    padding: 8px;
}

.duplicate-item-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 10px;
    border-radius: 8px;
    font-size: 13px;
}

.duplicate-item-row:hover {
    background: white;
}

.duplicate-item-info {
    display: flex;
    flex-direction: column;
    min-width: 0;
    flex: 1;
}

.duplicate-item-info small {
    color: #94a3b8;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.duplicate-item-actions {
    display: flex;
    gap: 6px;
}

/* Badges e Trigger Words */
.item-name-row {
    display: flex;
    align-items: center;
    gap: 8px;
}

.base-model-badge {
    padding: 2px 8px;
    background: #f5f3ff;
    border: 1px solid #ddd6fe;
    color: #6d28d9;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 700;
}

.trigger-words-list {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px;
    margin: 6px 0;
}

.trigger-label {
    font-size: 11px;
    color: #64748b;
    font-weight: 600;
}

.trigger-tag {
    padding: 3px 8px;
    background: #f1f5f9;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    color: #334155;
    font-size: 11px;
    cursor: pointer;
    transition: all 0.2s;
}

.trigger-tag:hover {
    background: #e0e7ff;
    border-color: #a5b4fc;
    color: #4338ca;
}
.results-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.results-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
    padding: 16px;
    background: white;
    border-radius: 12px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.header-left {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

h2 {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
    color: #1f2937;
}

.stats {
    display: flex;
    gap: 16px;
}

.stat {
    font-size: 14px;
    color: #6b7280;
}

.header-actions {
    display: flex;
    gap: 8px;
}

.search-input {
    min-width: 180px;
    padding: 8px 12px;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 14px;
}

.export-status {
    margin: 0;
    padding: 10px 14px;
    color: #166534;
    background: #dcfce7;
    border: 1px solid #bbf7d0;
    border-radius: 8px;
    font-size: 14px;
}

.export-select {
    padding: 8px 12px;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 14px;
    cursor: pointer;
    outline: none;
}

.export-btn {
    padding: 8px 16px;
    background: #6366f1;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s;
}

.export-btn:hover {
    background: #4f46e5;
}

.reset-btn {
    padding: 8px 16px;
    background: #f3f4f6;
    color: #374151;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
}

.reset-btn:hover {
    background: #e5e7eb;
}

.categories-summary {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    padding: 12px;
    background: white;
    border-radius: 12px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.category-summary-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
}

.category-summary-item:hover {
    background: #f3f4f6;
    border-color: #d1d5db;
}

.category-summary-item.active {
    background: #eef2ff;
    border-color: #818cf8;
}

.category-name {
    font-size: 13px;
    font-weight: 500;
    color: #374151;
}

.category-count {
    font-size: 12px;
    font-weight: 600;
    color: #6366f1;
    background: #eef2ff;
    padding: 2px 8px;
    border-radius: 12px;
}

.results-content {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.category-section {
    background: white;
    border-radius: 12px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    overflow: hidden;
}

.category-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 16px;
    background: #f9fafb;
    border-bottom: 1px solid #e5e7eb;
    cursor: pointer;
    transition: background 0.2s;
}

.category-header:hover {
    background: #f3f4f6;
}

.expand-icon {
    font-size: 10px;
    color: #6b7280;
    width: 16px;
}

.category-title {
    flex: 1;
    font-size: 15px;
    font-weight: 600;
    color: #1f2937;
}

.category-badge {
    font-size: 12px;
    font-weight: 600;
    color: #6366f1;
    background: #eef2ff;
    padding: 2px 10px;
    border-radius: 12px;
}

.category-items {
    padding: 8px;
}

.item-card {
    display: flex;
    gap: 12px;
    padding: 12px;
    border-radius: 8px;
    transition: background 0.2s;
}

.item-card:hover {
    background: #f9fafb;
}

.item-icon {
    font-size: 24px;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f3f4f6;
    border-radius: 8px;
    flex-shrink: 0;
}

.item-info {
    flex: 1;
    min-width: 0;
}

.item-name {
    font-size: 14px;
    font-weight: 500;
    color: #1f2937;
    margin-bottom: 4px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.item-path {
    font-size: 12px;
    color: #6b7280;
    margin-bottom: 4px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.item-meta {
    display: flex;
    gap: 12px;
    font-size: 11px;
    color: #9ca3af;
}

.item-size {
    font-weight: 500;
}

/* Refined visual layer */
.results-list { gap: 18px; }
.results-header { padding: 22px; background: rgba(255,255,255,.86); border: 1px solid rgba(148,163,184,.22); border-radius: 20px; box-shadow: 0 18px 48px rgba(15,23,42,.07); }
h2 { font-size: 22px; font-weight: 750; letter-spacing: -.025em; color: #18233a; }
.header-actions { flex-wrap: wrap; justify-content: flex-end; }
.search-input, .export-select { border-color: #d9dfeb; border-radius: 10px; background: #f8fafc; }
.export-btn { border-radius: 10px; background: #312e81; }
.export-btn:hover { background: #4338ca; }
.reset-btn { border-radius: 10px; }
.categories-summary { padding: 14px; background: rgba(255,255,255,.72); border: 1px solid rgba(148,163,184,.20); border-radius: 16px; box-shadow: none; }
.category-summary-item { background: #fff; border-color: #e2e8f0; border-radius: 999px; }
.category-summary-item.active { background: #f5f3ff; border-color: #a78bfa; }
.category-section { background: rgba(255,255,255,.88); border: 1px solid rgba(148,163,184,.20); border-radius: 16px; box-shadow: 0 10px 30px rgba(15,23,42,.04); }
.category-header { background: linear-gradient(90deg, #fafaff, #f8fafc); border-bottom-color: #edf0f5; }
.item-card { border: 1px solid transparent; border-radius: 12px; transition: background .2s, border-color .2s, transform .2s; }
.item-card:hover { background: #fafaff; border-color: #e0e7ff; transform: translateX(2px); }
.item-icon { background: linear-gradient(135deg, #eef2ff, #ecfeff); border-radius: 12px; }
.item-type { padding: 2px 7px; border-radius: 999px; background: #f1f5f9; color: #64748b; text-transform: uppercase; letter-spacing: .05em; }
.item-actions { display: flex; gap: 4px; align-items: center; }
.item-action-btn { width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; cursor: pointer; font-size: 14px; transition: all .2s; }
.item-action-btn:hover { background: #f5f3ff; border-color: #c4b5fd; transform: scale(1.05); }
.item-action-btn.danger:hover { background: #fee2e2; border-color: #fecaca; }
.modal-overlay { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(15, 23, 42, .5); z-index: 1000; backdrop-filter: blur(4px); }
.modal { width: 100%; max-width: 440px; padding: 24px; background: white; border-radius: 16px; box-shadow: 0 24px 64px rgba(15, 23, 42, .25); }
.modal h3 { margin: 0 0 12px; font-size: 18px; font-weight: 700; color: #1e293b; }
.modal-path { font-size: 12px; color: #6b7280; margin: 0 0 12px; word-break: break-all; }
.modal-input { width: 100%; padding: 10px 14px; border: 1px solid #d9dfeb; border-radius: 10px; font-size: 14px; outline: none; box-sizing: border-box; }
.modal-input:focus { border-color: #7c3aed; box-shadow: 0 0 0 4px rgba(124, 58, 237, .12); }
.modal-error { color: #dc2626; font-size: 13px; margin: 8px 0 0; }
.modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; }
.modal-cancel-btn { padding: 10px 18px; background: #f8fafc; border: 1px solid #d9dfeb; border-radius: 10px; cursor: pointer; font-size: 14px; font-weight: 500; }
.modal-cancel-btn:hover { background: #e5e7eb; }
.modal-save-btn { padding: 10px 18px; background: #7c3aed; color: white; border: none; border-radius: 10px; cursor: pointer; font-size: 14px; font-weight: 600; }
.modal-save-btn:hover { background: #6d28d9; }
.modal-delete-btn { padding: 10px 18px; background: #dc2626; color: white; border: none; border-radius: 10px; cursor: pointer; font-size: 14px; font-weight: 600; }
.modal-delete-btn:hover { background: #b91c1c; }
@media (max-width: 820px) { .results-header { flex-direction: column; } .header-actions { width: 100%; justify-content: flex-start; } .search-input { flex: 1 1 220px; } }
@media (max-width: 520px) { .header-actions > * { flex: 1 1 45%; } .search-input { flex-basis: 100%; } .stats { flex-wrap: wrap; } }
</style>
