<script setup lang="ts">
import { ref, watch, computed, onMounted } from 'vue';
import {
  getApiKey,
  setApiKey,
  setApiModel,
  getApiModel,
  getAiMode,
  setAiMode,
  getAiProvider,
  setAiProvider,
  getAiBaseUrl,
  setAiBaseUrl,
  detectProvider,
  setPersistenceEnabled,
  isPersistenceEnabled,
  listModels as listGeminiModels,
  ollamaListModels,
  createAiClient,
  DEFAULT_AI_BASE_URL,
  invalidateAiConfigCache,
  initializeAiConfig,
} from '@bosguega/ai-core';
import type { AIMode, AIProvider, TestConnectionResult } from '@bosguega/ai-core';
import { testOllamaEmbedding } from '../services/embeddingService';

type ConnectionStatus = 'idle' | 'checking' | 'connected' | 'error' | 'offline';

const ONLINE_DEFAULT_MODELS: Record<string, string[]> = {
  gemini: [
    'gemini-1.5-flash',
    'gemini-1.5-flash-lite',
    'gemini-1.5-pro',
    'gemini-1.0-pro',
  ],
  openai: ['gpt-3.5-turbo', 'gpt-4o-mini', 'gpt-4o'],
};

const DEFAULT_MODEL_BY_PROVIDER: Record<string, string> = {
  gemini: 'gemini-1.5-flash-lite',
  openai: 'gpt-4o-mini',
  ollama: '',
};

const CONNECTION_LABELS: Record<ConnectionStatus, string> = {
  idle: 'Testar conexão',
  offline: 'Offline',
  checking: 'Verificando...',
  connected: 'Conexão OK',
  error: 'Erro na conexão',
};

const emit = defineEmits<{
  close: [];
  saved: [];
}>();

// ── state ──
const mode = ref<AIMode>('online');
const key = ref('');
const baseUrl = ref(DEFAULT_AI_BASE_URL);
const selectedModel = ref('');
const testing = ref(false);
const connectionStatus = ref<ConnectionStatus>('idle');
const fetchedModels = ref<string[]>([]);
const fetchingModels = ref(false);
const persist = ref(false);
const loading = ref(true);

const testingEmbedding = ref(false);
const embeddingConnectionStatus = ref<ConnectionStatus>('idle');

// Computed provider
const onlineProvider = computed(() => {
  const detected = detectProvider(key.value || null);
  return detected === 'gemini' || detected === 'openai' ? detected : 'unknown';
});

const effectiveProvider = computed(() =>
  mode.value === 'local' ? 'ollama' : onlineProvider.value,
);

const providerLabel = computed(() => {
  const p = effectiveProvider.value;
  if (p === 'gemini') return 'Google AI Studio';
  if (p === 'openai') return 'OpenAI';
  if (p === 'ollama') return 'Ollama';
  return 'Desconhecido';
});

const providerDefaultModel = computed(() => {
  const p = effectiveProvider.value;
  if (p === 'unknown') return DEFAULT_MODEL_BY_PROVIDER.gemini;
  return DEFAULT_MODEL_BY_PROVIDER[p] ?? '';
});

const models = computed(() => {
  const hardcoded =
    mode.value === 'local'
      ? []
      : effectiveProvider.value === 'gemini' || effectiveProvider.value === 'openai'
        ? ONLINE_DEFAULT_MODELS[effectiveProvider.value] ?? []
        : [];
  const all = Array.from(new Set([...hardcoded, ...fetchedModels.value]));
  if (selectedModel.value && !all.includes(selectedModel.value)) {
    all.push(selectedModel.value);
  }
  return all;
});

const isBgeM3Installed = computed(() => {
  if (mode.value !== 'local') return true;
  if (fetchedModels.value.length === 0) return true;
  return fetchedModels.value.some((name) => name.toLowerCase().includes('bge-m3'));
});

const canFetchModels = computed(() => mode.value === 'local' || !!key.value.trim());

// ── lifecycle ──
onMounted(async () => {
  const [savedKey, savedModel, savedMode, savedBaseUrl, savedPersist] = await Promise.all([
    getApiKey(),
    getApiModel(),
    getAiMode(),
    getAiBaseUrl(),
    isPersistenceEnabled(),
  ]);

  key.value = savedKey ?? '';
  mode.value = savedMode;
  selectedModel.value = savedModel;
  baseUrl.value = savedBaseUrl;
  persist.value = savedPersist;

  // Load models on mount if online and has key
  if (mode.value === 'online' && key.value && onlineProvider.value !== 'unknown') {
    await fetchModels();
  }

  loading.value = false;
});

// Reset models when key changes
watch(key, () => {
  fetchedModels.value = [];
  connectionStatus.value = 'idle';
});

// Auto-select model based on provider
watch(
  [effectiveProvider, fetchedModels, mode],
  () => {
    if (mode.value === 'local') {
      if (!selectedModel.value && fetchedModels.value.length > 0) {
        selectedModel.value = fetchedModels.value[0];
      }
      return;
    }

    if (!selectedModel.value) {
      selectedModel.value = providerDefaultModel.value;
      return;
    }

    const isGoogle = selectedModel.value.startsWith('gemini-');
    const isOpenAI = selectedModel.value.startsWith('gpt-');
    const changed =
      (effectiveProvider.value === 'gemini' && isOpenAI) ||
      (effectiveProvider.value === 'openai' && isGoogle);

    if (changed) {
      selectedModel.value = providerDefaultModel.value;
    }
  },
  { immediate: true },
);

// ── actions ──
function handleModeChange(next: AIMode) {
  mode.value = next;
  fetchedModels.value = [];
  connectionStatus.value = 'idle';
  selectedModel.value = next === 'local' ? '' : providerDefaultModel.value;
}

async function fetchModels() {
  fetchingModels.value = true;
  connectionStatus.value = 'checking';

  try {
    if (mode.value === 'local') {
      const url = baseUrl.value || DEFAULT_AI_BASE_URL;
      const models = await ollamaListModels(url);
      const names = models.map((m: { id: string }) => m.id);
      fetchedModels.value = names;
      if (!selectedModel.value && names.length > 0) {
        // Evita auto-selecionar o bge-m3 ou outros modelos de embedding para a LLM
        const chatModels = names.filter(
          (name) => !name.toLowerCase().includes('embed') && !name.toLowerCase().includes('bge')
        );
        if (chatModels.length > 0) {
          selectedModel.value = chatModels[0];
        } else {
          selectedModel.value = names[0];
        }
      }
      connectionStatus.value = 'idle';
      return;
    }

    const trimmedKey = key.value.trim();
    if (!trimmedKey) {
      connectionStatus.value = 'error';
      return;
    }

    if (onlineProvider.value === 'gemini') {
      const models = await listGeminiModels(trimmedKey);
      const names = models.map((m: { id: string }) => m.id);
      fetchedModels.value = names;
      connectionStatus.value = 'connected';
      return;
    }

    if (onlineProvider.value === 'openai') {
      fetchedModels.value = [];
      connectionStatus.value = 'connected';
      return;
    }

    connectionStatus.value = 'error';
  } catch {
    connectionStatus.value = mode.value === 'local' ? 'offline' : 'error';
  } finally {
    fetchingModels.value = false;
  }
}

async function handleTest() {
  const provider = effectiveProvider.value;
  if (provider === 'unknown' as AIProvider) return;

  if (mode.value === 'online' && !key.value.trim()) return;
  if (!selectedModel.value) return;

  testing.value = true;
  connectionStatus.value = 'checking';

  try {
    const client = createAiClient({
      apiKey: mode.value === 'online' ? key.value.trim() : undefined,
      baseUrl: mode.value === 'local' ? baseUrl.value || DEFAULT_AI_BASE_URL : undefined,
      provider: provider as any,
      model: selectedModel.value,
    });

    const result: TestConnectionResult = await client.testConnection();
    connectionStatus.value = result.success ? 'connected' : mode.value === 'local' ? 'offline' : 'error';
  } catch {
    connectionStatus.value = mode.value === 'local' ? 'offline' : 'error';
  } finally {
    testing.value = false;
  }
}

async function handleTestEmbedding() {
  testingEmbedding.value = true;
  embeddingConnectionStatus.value = 'checking';

  try {
    const result = await testOllamaEmbedding(baseUrl.value || DEFAULT_AI_BASE_URL);
    embeddingConnectionStatus.value = result.success ? 'connected' : 'offline';
    
    // Se obteve sucesso e não há modelos cacheados, popula a lista silenciosamente
    if (result.success && fetchedModels.value.length === 0) {
      try {
        const models = await ollamaListModels(baseUrl.value || DEFAULT_AI_BASE_URL);
        fetchedModels.value = models.map((m: { id: string }) => m.id);
      } catch {
        // Silencioso
      }
    }
  } catch {
    embeddingConnectionStatus.value = 'offline';
  } finally {
    testingEmbedding.value = false;
  }
}

async function handleSave() {
  const provider = mode.value === 'local' ? 'ollama' : onlineProvider.value;

  if (mode.value === 'online') {
    const trimmedKey = key.value.trim();
    if (!trimmedKey) return;
    if (onlineProvider.value === 'unknown') return;

    await setPersistenceEnabled(persist.value);
    await setAiMode('online');
    await setAiProvider(provider as AIProvider);
    await setApiModel(selectedModel.value);
    await setApiKey(trimmedKey);
  } else {
    if (!selectedModel.value) return;

    await setPersistenceEnabled(persist.value);
    await setAiMode('local');
    await setAiProvider('ollama');
    await setAiBaseUrl(baseUrl.value || DEFAULT_AI_BASE_URL);
    await setApiModel(selectedModel.value);
    await setApiKey('');
  }

  // Invalida e recarrega o cache sincronamente para o restante do app
  invalidateAiConfigCache();
  await initializeAiConfig();

  emit('saved');
  emit('close');
}

function handleClose() {
  emit('close');
}
</script>

<template>
  <div class="modal-overlay" @click.self="handleClose">
    <div class="ai-config-modal">
      <!-- Header -->
      <div class="modal-header">
        <div class="modal-title">
          <span class="title-icon">{{ mode === 'local' ? '🖥️' : '🔑' }}</span>
          <h2>Configurar IA</h2>
        </div>
        <button class="close-btn" @click="handleClose">✕</button>
      </div>

      <!-- Mode Toggle -->
      <div class="mode-toggle">
        <button
          :class="{ active: mode === 'online' }"
          @click="handleModeChange('online')"
        >
          IA Online
        </button>
        <button
          :class="{ active: mode === 'local' }"
          @click="handleModeChange('local')"
        >
          IA Local
        </button>
      </div>

      <!-- Provider & Model Card -->
      <div class="config-card">
        <div class="provider-row">
          <span class="label">Provider:</span>
          <span class="provider-value">{{ providerLabel }}</span>
        </div>

        <!-- Model selector -->
        <div class="field">
          <div class="model-header">
            <label>Modelo:</label>
            <button
              class="fetch-btn"
              :disabled="fetchingModels || !canFetchModels"
              @click="fetchModels"
            >
              {{ fetchingModels ? '🔄' : '🔃' }} Buscar modelos
            </button>
          </div>
          <select v-model="selectedModel" @change="connectionStatus = 'idle'">
            <option disabled value="">
              {{ mode === 'local' ? 'Busque modelos locais' : 'Informe uma API key válida' }}
            </option>
            <option v-for="m in models" :key="m" :value="m">
              {{ m }}
            </option>
          </select>
        </div>
      </div>

      <!-- API Key (online only) -->
      <div v-if="mode === 'online'" class="key-section">
        <label class="field-label">API KEY</label>
        <input
          type="password"
          v-model="key"
          :placeholder="onlineProvider === 'gemini' ? 'AIza...' : 'sk-...'"
          class="key-input"
          @input="connectionStatus = 'idle'"
        />
        <label class="persist-check">
          <input type="checkbox" v-model="persist" />
          <span>Salvar permanentemente neste dispositivo</span>
        </label>
        <p class="persist-hint">
          {{ persist
            ? 'A chave será mantida mesmo após fechar o app.'
            : 'A chave será apagada por segurança ao fechar o app.' }}
        </p>
      </div>

      <!-- Persist checkbox for local mode -->
      <div v-if="mode === 'local'" class="key-section">
        <label class="persist-check">
          <input type="checkbox" v-model="persist" />
          <span>Manter configurações salvas</span>
        </label>
      </div>

      <!-- Seção dedicada de Embeddings (Ollama bge-m3) -->
      <div class="config-card embedding-section">
        <div class="provider-row">
          <span class="label">Serviço de Embeddings:</span>
          <span class="provider-value">Ollama (bge-m3)</span>
        </div>

        <div class="field">
          <label>URL do Ollama (Embeddings):</label>
          <div class="input-with-btn">
            <input
              v-model="baseUrl"
              :placeholder="DEFAULT_AI_BASE_URL"
              @input="embeddingConnectionStatus = 'idle'"
            />
            <button
              type="button"
              class="btn-test-embed"
              :class="{
                'status-success': embeddingConnectionStatus === 'connected',
                'status-error': embeddingConnectionStatus === 'error' || embeddingConnectionStatus === 'offline',
              }"
              :disabled="testingEmbedding"
              @click="handleTestEmbedding"
            >
              <span v-if="testingEmbedding">🔄</span>
              <span v-else-if="embeddingConnectionStatus === 'connected'">✓ OK</span>
              <span v-else-if="embeddingConnectionStatus === 'offline' || embeddingConnectionStatus === 'error'">✗ Erro</span>
              <span v-else>Testar</span>
            </button>
          </div>
        </div>

        <!-- Alerta de bge-m3 ausente para busca vetorial local -->
        <div v-if="!isBgeM3Installed" class="embedding-warning">
          ⚠️ O modelo de embeddings <strong>bge-m3</strong> não foi detectado no seu Ollama.
          Execute no seu terminal para que a busca vetorial funcione:
          <code>ollama pull bge-m3</code>
        </div>
      </div>

      <!-- Actions -->
      <div class="actions">
        <button
          class="btn-test"
          :class="{
            'status-success': connectionStatus === 'connected',
            'status-error': connectionStatus === 'error' || connectionStatus === 'offline',
          }"
          :disabled="testing"
          @click="handleTest"
        >
          <span v-if="connectionStatus === 'connected'">✓</span>
          <span v-else-if="connectionStatus === 'error' || connectionStatus === 'offline'">✗</span>
          {{ testing ? CONNECTION_LABELS[connectionStatus] : CONNECTION_LABELS[connectionStatus] }}
        </button>

        <div class="action-row">
          <button class="btn-secondary" @click="handleClose">Cancelar</button>
          <button class="btn-primary" @click="handleSave">Salvar</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}

.ai-config-modal {
  background: var(--panel-bg);
  backdrop-filter: blur(12px);
  border: 1px solid var(--accent);
  border-radius: 16px;
  padding: 24px;
  max-width: 480px;
  width: 90%;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-title {
  display: flex;
  align-items: center;
  gap: 10px;
}

.title-icon {
  font-size: 1.4rem;
}

.modal-title h2 {
  margin: 0;
  font-size: 1.2rem;
  color: var(--text-primary);
}

.close-btn {
  background: transparent;
  border: none;
  color: var(--text-secondary);
  font-size: 1.2rem;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: white;
}

/* Mode Toggle */
.mode-toggle {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.mode-toggle button {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 10px;
  color: var(--text-secondary);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.mode-toggle button.active {
  background: rgba(56, 189, 248, 0.15);
  border-color: var(--accent);
  color: var(--accent);
}

.mode-toggle button:hover:not(.active) {
  background: rgba(255, 255, 255, 0.08);
}

/* Config Card */
.config-card {
  background: rgba(15, 23, 42, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.provider-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.provider-row .label {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.provider-value {
  font-size: 0.75rem;
  color: var(--accent);
  font-weight: bold;
}

/* Fields */
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field label {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.field input {
  background: var(--bg-color);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px 14px;
  color: var(--text-primary);
  font-size: 0.9rem;
  outline: none;
  transition: border-color 0.2s;
}

.field input:focus {
  border-color: var(--accent);
}

.model-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.fetch-btn {
  background: none;
  border: none;
  color: var(--accent);
  font-size: 0.7rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  opacity: 1;
}

.fetch-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.field select {
  background: var(--bg-color);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px 14px;
  color: var(--text-primary);
  font-size: 0.9rem;
  outline: none;
  cursor: pointer;
  transition: border-color 0.2s;
  appearance: auto;
}

.field select:focus {
  border-color: var(--accent);
}

.field select option {
  background: #1e1e2e;
  color: white;
}

/* Key Section */
.key-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.field-label {
  font-size: 0.8rem;
  font-weight: bold;
  color: var(--text-secondary);
}

.key-input {
  background: rgba(15, 23, 42, 0.4);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px 14px;
  color: var(--text-primary);
  font-size: 0.9rem;
  outline: none;
  transition: border-color 0.2s;
}

.key-input:focus {
  border-color: var(--accent);
}

.persist-check {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
  padding: 4px 0;
}

.persist-check input {
  width: 18px;
  height: 18px;
  accent-color: var(--accent);
}

.persist-check span {
  font-size: 0.85rem;
  color: var(--text-primary);
}

.persist-hint {
  font-size: 0.7rem;
  color: var(--text-secondary);
  margin: 0;
  padding-left: 26px;
}

/* Actions */
.actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.btn-test {
  width: 100%;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 12px;
  color: var(--text-primary);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-test:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-test.status-success {
  background: rgba(16, 185, 129, 0.1);
  border-color: #10b981;
  color: #10b981;
}

.btn-test.status-error {
  background: rgba(239, 68, 68, 0.1);
  border-color: var(--error);
  color: var(--error);
}

.action-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.btn-secondary {
  background: transparent;
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 10px;
  color: var(--text-secondary);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.05);
}

.btn-primary {
  background: var(--accent);
  border: none;
  border-radius: 10px;
  padding: 10px;
  color: #0f172a;
  font-size: 0.9rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary:hover {
  background: var(--accent-hover);
}

.embedding-warning {
  background: rgba(245, 158, 11, 0.08);
  border: 1px solid rgba(245, 158, 11, 0.25);
  border-radius: 10px;
  padding: 12px;
  font-size: 0.8rem;
  color: #f59e0b;
  line-height: 1.4;
  text-align: left;
}

.embedding-warning code {
  display: block;
  background: rgba(0, 0, 0, 0.25);
  padding: 4px 8px;
  border-radius: 6px;
  margin-top: 6px;
  font-family: monospace;
  color: #fbbf24;
  font-size: 0.75rem;
}

.input-with-btn {
  display: flex;
  gap: 8px;
}

.input-with-btn input {
  flex: 1;
}

.btn-test-embed {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px 16px;
  color: var(--text-primary);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.btn-test-embed:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-test-embed.status-success {
  background: rgba(16, 185, 129, 0.1);
  border-color: #10b981;
  color: #10b981;
}

.btn-test-embed.status-error {
  background: rgba(239, 68, 68, 0.1);
  border-color: var(--error);
  color: var(--error);
}
</style>