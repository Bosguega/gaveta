<script setup lang="ts">
import { ref } from 'vue';
import AiConfigModal from '../components/AiConfigModal.vue';

const emit = defineEmits<{
  saved: [];
}>();

const showAiConfig = ref(false);

function openAiConfig() {
  showAiConfig.value = true;
}

function closeAiConfig() {
  showAiConfig.value = false;
}

function onAiConfigSaved() {
  closeAiConfig();
  emit('saved');
}
</script>

<template>
  <section class="panel settings-panel">
    <h2>Configurações</h2>

    <div class="settings-form">
      <div class="settings-card" @click="openAiConfig">
        <div class="card-icon">🤖</div>
        <div class="card-body">
          <strong>Inteligência Artificial</strong>
          <p>Configurar API key, modelo, provedor online ou local</p>
        </div>
        <span class="card-arrow">→</span>
      </div>

      <div class="info-box">
        <p>
          O app usa IA para gerar embeddings e responder perguntas sobre suas notas.
          Você pode usar o Google AI Studio (Gemini), OpenAI ou modelos locais via Ollama.
        </p>
      </div>
    </div>

    <AiConfigModal
      v-if="showAiConfig"
      @close="closeAiConfig"
      @saved="onAiConfigSaved"
    />
  </section>
</template>

<style scoped>
.settings-panel {
  max-width: 500px;
  margin: 0 auto;
}

.settings-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.settings-card {
  display: flex;
  align-items: center;
  gap: 14px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 16px;
  cursor: pointer;
  transition: all 0.2s;
}

.settings-card:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: var(--accent);
}

.card-icon {
  font-size: 1.5rem;
  flex-shrink: 0;
}

.card-body {
  flex: 1;
}

.card-body strong {
  display: block;
  font-size: 0.95rem;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.card-body p {
  margin: 0;
  font-size: 0.8rem;
  color: var(--text-secondary);
  line-height: 1.4;
}

.card-arrow {
  color: var(--text-secondary);
  font-size: 1.2rem;
  flex-shrink: 0;
}

.info-box {
  background: rgba(56, 189, 248, 0.06);
  border: 1px solid rgba(56, 189, 248, 0.15);
  border-radius: 10px;
  padding: 14px;
}

.info-box p {
  margin: 0;
  font-size: 0.8rem;
  color: var(--text-secondary);
  line-height: 1.5;
}
</style>