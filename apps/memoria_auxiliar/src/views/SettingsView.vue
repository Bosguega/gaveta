<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import {
  getApiKey,
  setApiKey,
  getApiModel,
  setApiModel,
  detectProvider,
  hasApiKey,
  listModels,
} from '@bosguega/gaveta-de-bagunca';
import type { ModelInfo } from '@bosguega/gaveta-de-bagunca';

const apiKey = ref('');
const model = ref('');
const provider = ref('');
const showKey = ref(false);
const isSaving = ref(false);
const saveMessage = ref('');
const models = ref<ModelInfo[]>([]);
const isFetchingModels = ref(false);
const fetchError = ref('');

onMounted(async () => {
  const key = await getApiKey();
  apiKey.value = key ?? '';
  model.value = await getApiModel();
  updateProvider();
  if (apiKey.value) {
    await fetchModels();
  }
});

watch(apiKey, (newVal) => {
  updateProvider();
  // Se a chave mudou, limpa a lista de modelos
  models.value = [];
});

async function fetchModels() {
  const key = apiKey.value;
  if (!key) return;
  isFetchingModels.value = true;
  fetchError.value = '';
  try {
    const result = await listModels(key);
    models.value = result;
  } catch (err) {
    fetchError.value = err instanceof Error ? err.message : 'Erro ao buscar modelos.';
  } finally {
    isFetchingModels.value = false;
  }
}

function updateProvider() {
  provider.value = detectProvider(apiKey.value || null);
}

async function save() {
  isSaving.value = true;
  saveMessage.value = '';
  try {
    await setApiKey(apiKey.value || null);
    await setApiModel(model.value);
    saveMessage.value = 'Configurações salvas com sucesso!';
    setTimeout(() => (saveMessage.value = ''), 3000);
  } catch (err) {
    saveMessage.value = err instanceof Error ? err.message : 'Erro ao salvar.';
  } finally {
    isSaving.value = false;
  }
}
</script>

<template>
  <section class="panel settings-panel">
    <h2>Configurações da IA</h2>

    <div class="settings-form">
      <div class="field">
        <label for="apiKey">Chave da API</label>
        <div class="input-with-toggle">
          <input
            id="apiKey"
            v-model="apiKey"
            :type="showKey ? 'text' : 'password'"
            placeholder="Cole sua chave aqui"
          />
          <button
            type="button"
            class="toggle-visibility"
            @click="showKey = !showKey"
            :title="showKey ? 'Ocultar chave' : 'Mostrar chave'"
          >
            {{ showKey ? '🙈' : '👁️' }}
          </button>
        </div>
      </div>

      <div class="field">
        <label>Provedor detectado</label>
        <p class="provider-badge">{{ provider }}</p>
      </div>

      <div class="field">
        <label for="model">Modelo</label>
        <div class="model-select-row">
          <select
            id="model"
            v-model="model"
            :disabled="isFetchingModels"
          >
            <option disabled value="">Selecione um modelo</option>
            <option v-for="m in models" :key="m.id" :value="m.id">
              {{ m.name }}
            </option>
          </select>
          <button
            type="button"
            class="refresh-models"
            @click="fetchModels"
            :disabled="isFetchingModels || !apiKey"
            :title="isFetchingModels ? 'Buscando...' : 'Atualizar lista de modelos'"
          >
            {{ isFetchingModels ? '🔄' : '🔃' }}
          </button>
        </div>
        <p v-if="fetchError" class="field-error">Erro ao carregar modelos: {{ fetchError }}</p>
        <p v-else-if="!apiKey" class="field-hint">Informe a chave da API e clique em 🔃 para carregar os modelos.</p>
        <p v-else-if="models.length === 0 && !isFetchingModels" class="field-hint">Nenhum modelo encontrado. Clique em 🔃 para buscar.</p>
      </div>

      <div class="settings-actions">
        <button type="button" class="primary" @click="save" :disabled="isSaving">
          {{ isSaving ? 'Salvando...' : 'Salvar' }}
        </button>
      </div>

      <p v-if="saveMessage" class="save-message">{{ saveMessage }}</p>
    </div>
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
  gap: 20px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field label {
  font-size: 0.85rem;
  font-weight: 600;
  opacity: 0.8;
}

.field input {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 10px 14px;
  border-radius: 8px;
  color: white;
  outline: none;
  font-size: 0.9rem;
  transition: border-color 0.2s;
}

.field input:focus {
  border-color: var(--primary-color, #3b82f6);
}

.input-with-toggle {
  display: flex;
  gap: 8px;
  align-items: center;
}

.input-with-toggle input {
  flex: 1;
}

.toggle-visibility {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 8px 12px;
  cursor: pointer;
  font-size: 1rem;
  transition: background 0.2s;
}

.toggle-visibility:hover {
  background: rgba(255, 255, 255, 0.1);
}

.provider-badge {
  background: rgba(16, 185, 129, 0.1);
  border: 1px solid rgba(16, 185, 129, 0.2);
  color: #10b981;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 0.85rem;
  display: inline-block;
  width: fit-content;
}

.settings-actions {
  display: flex;
  gap: 12px;
  margin-top: 8px;
}

.settings-actions button {
  flex: 1;
  padding: 10px 20px;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.settings-actions button.primary {
  background: var(--primary-color, #3b82f6);
  color: white;
}

.settings-actions button.primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.settings-actions button.secondary {
  background: rgba(255, 255, 255, 0.05);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.save-message {
  text-align: center;
  font-size: 0.85rem;
  opacity: 0.8;
  padding: 8px;
  border-radius: 6px;
  background: rgba(16, 185, 129, 0.1);
  border: 1px solid rgba(16, 185, 129, 0.2);
}

.model-select-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.model-select-row select {
  flex: 1;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 10px 14px;
  border-radius: 8px;
  color: white;
  outline: none;
  font-size: 0.9rem;
  cursor: pointer;
  transition: border-color 0.2s;
  appearance: auto;
}

.model-select-row select:focus {
  border-color: var(--primary-color, #3b82f6);
}

.model-select-row select option {
  background: #1e1e2e;
  color: white;
}

.model-select-row select:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.refresh-models {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 8px 12px;
  cursor: pointer;
  font-size: 1rem;
  transition: background 0.2s;
}

.refresh-models:hover {
  background: rgba(255, 255, 255, 0.1);
}

.refresh-models:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.field-error {
  font-size: 0.8rem;
  color: #ef4444;
  margin: 0;
}

.field-hint {
  font-size: 0.8rem;
  opacity: 0.6;
  margin: 0;
}
</style>
