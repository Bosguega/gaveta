import { ref, watch } from 'vue'
import { save } from '@tauri-apps/plugin-dialog';
import { listen } from '@tauri-apps/api/event';
import { computed } from 'vue'
import type { ScanProgress, ScanResult, SavedPath, WorkflowDependencyIndex, UsefulPath } from '@/types'
import {
    scanComfyuiDirectoryWithProgress,
    cancelComfyuiScan,
    getCommonComfyuiPaths,
    findComfyuiInstallations,
    getSavedPaths,
    saveExportFile,
    buildWorkflowDependencyIndex,
    getUsefulPaths,
    saveUsefulPaths,
    openInExplorer,
    renameModelFile,
    deleteModelFile
} from '@/services/scanner'
import { toInventory, filterImageCategories } from '@/inventory/inventory'
import { enrichItems } from '@/enrichment/inventory-enricher'
import { createCards } from '@/cards/card-factory'
import { buildSections } from '@/cards/section-builder'
import { renderJson } from '@/renderers/json-renderer'
import { renderCsv } from '@/renderers/csv-renderer'
import { htmlRenderer } from '@/renderers/html-renderer'
import { markdownRenderer } from '@/renderers/markdown-renderer'
import { txtRenderer } from '@/renderers/txt-renderer'

export const selectedPath = ref('')
export const scanResult = ref<ScanResult | null>(null)
export const isScanning = ref(false)
export const scanError = ref<string | null>(null)
export const exportFormat = ref<'json' | 'csv' | 'html' | 'md' | 'txt'>('json')
export const searchQuery = ref('')
export const selectedCategory = ref<string | null>(null)
export const sortBy = ref<'name' | 'size-desc' | 'size-asc'>('name')
export const exportStatus = ref<string | null>(null)
export const isExporting = ref(false)

export const commonPaths = ref<string[]>([])
export const savedPaths = ref<SavedPath[]>([])
export const foundPaths = ref<SavedPath[]>([])
export const scanningForInstallations = ref(false)
export const workflowIndex = ref<WorkflowDependencyIndex | null>(null)
export const isIndexingWorkflows = ref(false)
export const workflowIndexError = ref<string | null>(null)
export const usefulPaths = ref<UsefulPath[]>([])
export const usefulPathsError = ref<string | null>(null)
export const isSavingUsefulPaths = ref(false)
export const scanProgress = ref<ScanProgress | null>(null)
export const scanStageText = ref<string>('')
let progressUnlisten: (() => void) | undefined

export async function loadCommonPaths() {
    try {
        commonPaths.value = await getCommonComfyuiPaths()
    } catch (error) {
        console.error('Failed to load common paths:', error)
    }
}

export async function loadSavedPaths() {
    try {
        savedPaths.value = await getSavedPaths()
    } catch (error) {
        console.error('Failed to load saved paths:', error)
    }
}

export async function loadUsefulPaths() {
    if (!selectedPath.value) {
        usefulPaths.value = []
        return
    }
    try {
        usefulPaths.value = await getUsefulPaths(selectedPath.value)
        usefulPathsError.value = null
    } catch (error) {
        usefulPathsError.value = error instanceof Error ? error.message : 'Não foi possível carregar os atalhos úteis.'
        console.error('Failed to load useful paths:', error)
    }
}

export async function persistUsefulPaths() {
    if (!selectedPath.value) return
    isSavingUsefulPaths.value = true
    try {
        usefulPaths.value = await saveUsefulPaths(selectedPath.value, usefulPaths.value)
        usefulPathsError.value = null
    } catch (error) {
        usefulPathsError.value = error instanceof Error ? error.message : 'Não foi possível salvar os atalhos úteis.'
        console.error('Failed to save useful paths:', error)
    } finally {
        isSavingUsefulPaths.value = false
    }
}

export async function openFolder(path: string) {
    try {
        await openInExplorer(path)
    } catch (error) {
        usefulPathsError.value = error instanceof Error ? error.message : 'Não foi possível abrir a pasta.'
        console.error('Failed to open folder:', error)
    }
}

watch(selectedPath, () => {
    void loadUsefulPaths()
})

export async function findInstallations() {
    scanningForInstallations.value = true
    scanError.value = null

    try {
        foundPaths.value = await findComfyuiInstallations()
    } catch (error) {
        scanError.value = error instanceof Error ? error.message : 'Erro ao buscar instalações'
    } finally {
        scanningForInstallations.value = false
    }
}

export async function startScan() {
    if (!selectedPath.value) {
        scanError.value = 'Selecione um diretório do ComfyUI'
        return
    }

    isScanning.value = true
    scanError.value = null
    scanResult.value = null
    scanProgress.value = null
    scanStageText.value = 'Iniciando scan...'

    // Registra listener de progresso
    try {
        progressUnlisten = await listen<ScanProgress>('scan-progress', (event) => {
            scanProgress.value = event.payload
            if (event.payload.stage) {
                scanStageText.value = event.payload.stage
            }
        })
    } catch (error) {
        console.error('Failed to listen for scan progress:', error)
    }

    try {
        scanResult.value = await scanComfyuiDirectoryWithProgress(selectedPath.value)
        if (!scanResult.value.success) {
            scanError.value = scanResult.value.error || 'Erro desconhecido'
        } else {
            void refreshWorkflowIndex()
        }
    } catch (error) {
        console.error('Scan error:', error)
        scanError.value = error instanceof Error ? error.message : 'Erro ao escanear'
    } finally {
        isScanning.value = false
        scanProgress.value = null
        progressUnlisten?.()
        progressUnlisten = undefined
    }
}

export async function cancelScan() {
    try {
        await cancelComfyuiScan()
        scanStageText.value = 'Cancelando scan...'
    } catch (error) {
        console.error('Failed to cancel scan:', error)
    }
}

export function scanProgressPercent(): number {
    const progress = scanProgress.value
    if (!progress || progress.total === 0) return 0
    return Math.min(100, Math.round((progress.current / progress.total) * 100))
}

export async function renameModel(path: string, newName: string): Promise<void> {
    await renameModelFile(path, newName)
}

export async function deleteModel(path: string): Promise<void> {
    await deleteModelFile(path)
}

export async function refreshWorkflowIndex() {
    if (!selectedPath.value) return
    isIndexingWorkflows.value = true
    workflowIndexError.value = null
    try {
        workflowIndex.value = await buildWorkflowDependencyIndex(selectedPath.value)
    } catch (error) {
        workflowIndexError.value = error instanceof Error ? error.message : 'Não foi possível indexar os workflows.'
    } finally {
        isIndexingWorkflows.value = false
    }
}

export async function handleExport() {
    if (!scanResult.value || !scanResult.value.success) {
        return
    }

    try {
        isExporting.value = true
        exportStatus.value = null
        const inventory = filterImageCategories(toInventory(scanResult.value))

        let content: string
        switch (exportFormat.value) {
            case 'json':
                content = renderJson(inventory)
                break
            case 'csv':
                content = renderCsv(inventory)
                break
            case 'html':
            case 'md':
            case 'txt': {
                const enriched = enrichItems(inventory.items)
                const cards = createCards(enriched)
                const sections = buildSections(cards)
                content = exportFormat.value === 'html' ? htmlRenderer.render(sections)
                    : exportFormat.value === 'md' ? markdownRenderer.render(sections)
                        : txtRenderer.render(sections)
                break
            }
        }

        const defaultName = 'comfyui-scan-' + new Date().toISOString().split('T')[0] + '.' + exportFormat.value
        const selected = await save({
            defaultPath: defaultName,
            filters: [{
                name: exportFormat.value.toUpperCase(),
                extensions: [exportFormat.value]
            }]
        })

        if (selected) {
            await saveExportFile(selected, content)
            exportStatus.value = 'Relatório exportado com sucesso.'
        }
    } catch (error) {
        console.error('Export error:', error)
        exportStatus.value = error instanceof Error ? error.message : 'Não foi possível exportar o relatório.'
    } finally {
        isExporting.value = false
    }
}

export const filteredItems = computed(() => {
    if (!scanResult.value?.items) return []
    let items = [...scanResult.value.items]
    if (searchQuery.value) {
        const query = searchQuery.value.toLowerCase()
        items = items.filter(item =>
            item.name.toLowerCase().includes(query) ||
            item.category.toLowerCase().includes(query)
        )
    }
    if (selectedCategory.value) {
        items = items.filter(item => item.category === selectedCategory.value)
    }
    items.sort((a, b) => {
        if (sortBy.value === 'size-desc') return b.size_mb - a.size_mb
        if (sortBy.value === 'size-asc') return a.size_mb - b.size_mb
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    })
    return items
})

export const categories = computed(() => {
    if (!scanResult.value?.summary) return []
    return Object.entries(scanResult.value.summary)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
})

export const totalItems = computed(() => scanResult.value?.items.length || 0)

export const totalSize = computed(() => scanResult.value?.items.reduce((sum, item) => sum + item.size_mb, 0) || 0)

export function resetScan() {
    scanResult.value = null
    scanError.value = null
    searchQuery.value = ''
    selectedCategory.value = null
    workflowIndex.value = null
    workflowIndexError.value = null
}
