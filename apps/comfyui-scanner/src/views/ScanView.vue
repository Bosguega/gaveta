<script setup lang="ts">
import ScanControls from '@/components/ScanControls.vue';
import ResultsList from '@/components/ResultsList.vue';
import WorkflowDependencyIndex from '@/components/WorkflowDependencyIndex.vue';
import {
    scanResult,
    scanError,
    isScanning,
    scanStageText,
    scanProgress,
    scanProgressPercent,
    cancelScan,
    toasts
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
            <p>{{ scanStageText || 'Escaneando diretório...' }}</p>
            <div class="progress-bar">
                <div
                    class="progress-fill"
                    :class="{ 'is-indeterminate': !scanProgress?.total }"
                    :style="scanProgress?.total ? { width: scanProgressPercent() + '%' } : {}"
                ></div>
            </div>
            <span class="progress-text" v-if="scanProgress?.total">{{ scanProgressPercent() }}%</span>
            <button class="cancel-scan-btn" @click="cancelScan">
                Cancelar Scan
            </button>
        </div>

        <div v-if="scanError" class="error-message">
            <span class="error-icon">⚠️</span>
            <span>{{ scanError }}</span>
        </div>

        <ResultsList v-if="scanResult && scanResult.success" />
        <WorkflowDependencyIndex v-if="scanResult && scanResult.success" />

        <!-- Container de toasts -->
        <div class="toast-container">
            <div
                v-for="toast in toasts"
                :key="toast.id"
                class="toast"
                :class="'toast-' + toast.type"
            >
                <span class="toast-icon">
                    {{ toast.type === 'success' ? '✅' : toast.type === 'error' ? '❌' : 'ℹ️' }}
                </span>
                <span class="toast-message">{{ toast.message }}</span>
            </div>
        </div>
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

.progress-bar {
    width: 100%;
    max-width: 360px;
    height: 8px;
    background: #e5e7eb;
    border-radius: 999px;
    overflow: hidden;
}

.progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #7c3aed, #4f46e5);
    border-radius: 999px;
    transition: width .3s ease;
}

.progress-fill.is-indeterminate {
    width: 35%;
    transition: none;
    animation: progress-slide 1.4s ease-in-out infinite;
}

@keyframes progress-slide {
    0%   { transform: translateX(-150%); }
    100% { transform: translateX(400%); }
}

.progress-text {
    font-size: 12px;
    font-weight: 600;
    color: #6d28d9;
}

.cancel-scan-btn {
    padding: 8px 18px;
    background: #fee2e2;
    color: #dc2626;
    border: 1px solid #fecaca;
    border-radius: 10px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all .2s;
}

.cancel-scan-btn:hover {
    background: #fecaca;
}

.toast-container {
    position: fixed;
    top: 20px;
    right: 20px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    z-index: 2000;
    max-width: 360px;
}

.toast {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    background: white;
    border-radius: 12px;
    box-shadow: 0 8px 24px rgba(15, 23, 42, .15);
    border: 1px solid #e2e8f0;
    animation: toast-in .3s ease;
}

@keyframes toast-in {
    from { opacity: 0; transform: translateX(20px); }
    to { opacity: 1; transform: translateX(0); }
}

.toast-success { border-left: 4px solid #22c55e; }
.toast-error { border-left: 4px solid #ef4444; }
.toast-info { border-left: 4px solid #3b82f6; }

.toast-icon { font-size: 16px; }
.toast-message { font-size: 13px; color: #1e293b; font-weight: 500; }

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
