<script setup lang="ts">
import { ref } from 'vue';
import type { ScannedItem } from '@/types';
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
    isExporting
} from '@/composables/useComfyUIScan';

const expandedCategories = ref<Set<string>>(new Set());

function toggleCategory(category: string) {
    if (expandedCategories.value.has(category)) {
        expandedCategories.value.delete(category);
    } else {
        expandedCategories.value.add(category);
    }
}

function getItemsByCategory(category: string): ScannedItem[] {
    return filteredItems.value.filter(item => item.category === category);
}

function formatSize(size: number): string {
    if (size < 0.01) {
        return '< 0.01 MB';
    }
    return `${size.toFixed(2)} MB`;
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
</script>

<template>
    <div class="results-list" v-if="scanResult && scanResult.success">
        <div class="results-header">
            <div class="header-left">
                <h2>Resultados do Scan</h2>
                <div class="stats">
                    <span class="stat">
                        📁 {{ totalItems }} itens
                    </span>
                    <span class="stat">
                        💾 {{ formatSize(totalSize) }}
                    </span>
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
                            <div class="item-name">{{ item.name }}</div>
                            <div class="item-path">{{ item.path }}</div>
                            <div class="item-meta">
                                <span class="item-size">{{ formatSize(item.size_mb) }}</span>
                                <span class="item-type">{{ item.file_type }}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
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
@media (max-width: 820px) { .results-header { flex-direction: column; } .header-actions { width: 100%; justify-content: flex-start; } .search-input { flex: 1 1 220px; } }
@media (max-width: 520px) { .header-actions > * { flex: 1 1 45%; } .search-input { flex-basis: 100%; } .stats { flex-wrap: wrap; } }
</style>
