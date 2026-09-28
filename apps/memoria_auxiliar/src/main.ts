import { createApp } from 'vue';
import { buildEmbeddingProfile } from './services/embeddingProfile';
import { syncEmbeddingProfile } from './services/embeddingProfileSync';
import { getEmbeddingConfig } from './services/tauriStore';
import App from './App.vue';
import './styles.css';

// Garante que o banco e o pipeline de embeddings usam o mesmo perfil.
// Se o perfil mudou, o backend invalida cache e vetores antigos.
getEmbeddingConfig()
  .then((config) => syncEmbeddingProfile(buildEmbeddingProfile(config.model)))
  .catch((err) => console.error('Falha ao sincronizar o perfil de embeddings:', err))
  .finally(() => {
    createApp(App).mount('#app');
  });
