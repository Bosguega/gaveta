<script setup lang="ts">
import ScanView from '@/views/ScanView.vue';
</script>

<template>
    <div class="app">
        <ScanView />
    </div>
</template>

<style>
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    background: #f3f4f6;
    color: #1f2937;
    line-height: 1.6;
}

#app {
    min-height: 100vh;
}
</style>