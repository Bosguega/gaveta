import { createApp } from 'vue';
import { setConfigStore, initializeAiConfig } from '@bosguega/ai-core';
import { tauriStore } from './services/tauriStore';
import App from './App.vue';
import './styles.css';

// Injeta o store Tauri para persistir chave/modelo em config.json no sistema
setConfigStore(tauriStore);

// Inicializa o cache síncrono e monta o app
initializeAiConfig()
  .catch((err) => console.error('Falha ao inicializar o cache do ai-core:', err))
  .finally(() => {
    createApp(App).mount('#app');
  });
