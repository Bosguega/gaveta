import { createApp } from 'vue';
import { setConfigStore } from '@bosguega/ai-core';
import { tauriStore } from './services/tauriStore';
import App from './App.vue';
import './styles.css';

// Injeta o store Tauri para persistir chave/modelo em config.json no sistema
setConfigStore(tauriStore);

createApp(App).mount('#app');
