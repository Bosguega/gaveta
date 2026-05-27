<template>
    <div v-if="visible" class="dui-toolbar">
        <button
            v-for="btn in buttons"
            :key="btn.mode"
            :class="{ active: mode === btn.mode }"
            :title="btn.label"
            @click="setMode(btn.mode)"
        >
            {{ btn.icon }}
        </button>
    </div>
</template>

<script setup lang="ts">
import { useDeviceUI } from '../composables/useDeviceUI'

const { mode, setMode } = useDeviceUI()
const visible = import.meta.env.DEV

const buttons = [
    { mode: 'mobile' as const, icon: '📱', label: 'Mobile' },
    { mode: 'tablet' as const, icon: '📲', label: 'Tablet' },
    { mode: 'desktop' as const, icon: '🖥', label: 'Desktop' },
    { mode: 'auto' as const, icon: '🔄', label: 'Auto' },
]
</script>

<style scoped>
.dui-toolbar {
    position: fixed;
    bottom: 16px;
    right: 16px;
    display: flex;
    gap: 4px;
    padding: 8px;
    background: #1e1e1e;
    border-radius: 10px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    z-index: 9999;
}

.dui-toolbar button {
    padding: 6px 10px;
    border: 1px solid #444;
    border-radius: 6px;
    background: transparent;
    color: #ccc;
    font-size: 16px;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
}

.dui-toolbar button:hover {
    background: #333;
}

.dui-toolbar button.active {
    background: #3b82f6;
    border-color: #3b82f6;
    color: #fff;
}
</style>