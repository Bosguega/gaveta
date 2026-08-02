<script setup lang="ts">
import ScanControls from '@/components/ScanControls.vue';
import ResultsList from '@/components/ResultsList.vue';
import WorkflowDependencyIndex from '@/components/WorkflowDependencyIndex.vue';
import {
    scanResult,
    scanError,
    isScanning
} from '@/composables/useComfyUIScan';
</script>

<template>
    <div class="scan-view">
        <div class="app-header">
            <span class="eyebrow">INVENTÁRIO LOCAL</span>
            <h1>ComfyUI Scanner</h1>
            <p class="subtitle">Escaneie suas instalações do ComfyUI e gerencie modelos, nodes e workflows</p>
        </div>

        <ScanControls />

        <div v-if="isScanning" class="scanning-status">
            <div class="spinner"></div>
            <p>Escaneando diretório...</p>
        </div>

        <div v-if="scanError" class="error-message">
            <span class="error-icon">⚠️</span>
            <span>{{ scanError }}</span>
        </div>

        <ResultsList v-if="scanResult && scanResult.success" />
        <WorkflowDependencyIndex v-if="scanResult && scanResult.success" />
    </div>
</template>

<style scoped>
.scan-view {
    max-width: 1480px;
    margin: 0 auto;
    padding: 48px 28px 64px;
}

.app-header {
    text-align: left;
    margin: 0 auto 32px;
    max-width: 920px;
}

.eyebrow { display: inline-flex; margin-bottom: 10px; padding: 5px 10px; border: 1px solid rgba(124, 58, 237, .22); border-radius: 999px; background: rgba(255,255,255,.68); color: #6d28d9; font-size: 11px; font-weight: 800; letter-spacing: .12em; }

h1 {
    margin: 0 0 8px 0;
    font-size: clamp(34px, 5vw, 52px);
    font-weight: 800;
    letter-spacing: -.045em;
    background: linear-gradient(115deg, #312e81 0%, #7c3aed 45%, #0891b2 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
}

.subtitle {
    margin: 0;
    max-width: 650px;
    font-size: 16px;
    color: #64748b;
}

.scanning-status {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 48px 24px;
    background: white;
    border: 1px solid rgba(148, 163, 184, .20);
    border-radius: 20px;
    box-shadow: 0 18px 50px rgba(15, 23, 42, .08);
}

.spinner {
    width: 48px;
    height: 48px;
    border: 4px solid #e5e7eb;
    border-top-color: #6366f1;
    border-radius: 50%;
    animation: spin 1s linear infinite;
}

@keyframes spin {
    to { transform: rotate(360deg); }
}

.scanning-status p {
    font-size: 14px;
    color: #6b7280;
    margin: 0;
}

.error-message {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px;
    background: #fee2e2;
    border: 1px solid #fecaca;
    border-radius: 16px;
    color: #dc2626;
}

.error-icon {
    font-size: 20px;
}

.error-message span:last-child {
    font-size: 14px;
    font-weight: 500;
}

@media (max-width: 640px) { .scan-view { padding: 28px 16px 40px; } .app-header { margin-bottom: 24px; } }
</style>
