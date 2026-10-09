<script setup lang="ts">
/**
 * Modal de configuração dos servidores locais llama-server.
 *
 * Cada servidor tem um único card com o comando de inicialização (configuração
 * principal), status, botões de ação e resultado de teste.
 */
import { ref, onMounted, watch } from 'vue';
import {
  detectServerStatus,
  isServerOwned,
  portFromUrl,
  startServer,
  startServers,
  stopServer,
} from '../services/llamaServerControl';
import { testEmbeddingConnection, type ConnectionTestResult } from '../services/embeddingConnection';
import { probeServer } from '../services/llamaServerControl';
import {
  SERVER_STATUS_LABELS,
  shouldLaunchServer,
  type LlamaServerKind,
  type LlamaServerStatus,
} from '../services/llamaServerStatus';
import {
  getChatCommand,
  getChatConfig,
  getEmbeddingCommand,
  getEmbeddingConfig,
  setChatCommand,
  setEmbeddingCommand,
  withMcpServersConfig,
} from '../services/tauriStore';

const emit = defineEmits<{
  close: [];
}>();

/* ── Estado reativo ────────────────────────────────────────────────── */

const loading = ref(true);

// Configurações somente-leitura (derivadas do store)
const chatBaseUrl = ref('');
const chatModel = ref('');
const embeddingBaseUrl = ref('');
const embeddingModel = ref('');

// Comandos editáveis
const chatCommand = ref('');
const embeddingCommand = ref('');

// Status dos servidores
const chatStatus = ref<LlamaServerStatus>('parado');
const embeddingStatus = ref<LlamaServerStatus>('parado');
const chatError = ref('');
const embeddingError = ref('');
// Aviso não-bloqueante (ex.: servidor na porta não é o configurado)
const chatWarning = ref('');
const embeddingWarning = ref('');
const chatOwned = ref(false);
const embeddingOwned = ref(false);

// Teste de conexão
const testingChat = ref(false);
const testingEmbedding = ref(false);
const chatTestResult = ref('');
const embeddingTestResult = ref('');

// Controle geral
const busy = ref(false);

/* ── Auto-save com debounce ────────────────────────────────────────── */

let chatDebounce: ReturnType<typeof setTimeout> | null = null;
let embeddingDebounce: ReturnType<typeof setTimeout> | null = null;

watch(chatCommand, (value) => {
  if (chatDebounce) clearTimeout(chatDebounce);
  chatDebounce = setTimeout(() => void setChatCommand(value), 400);
});

watch(embeddingCommand, (value) => {
  if (embeddingDebounce) clearTimeout(embeddingDebounce);
  embeddingDebounce = setTimeout(() => void setEmbeddingCommand(value), 400);
});

/* ── Inicialização ─────────────────────────────────────────────────── */

onMounted(async () => {
  const [chatCfg, embeddingCfg, chatCmd, embeddingCmd] = await Promise.all([
    getChatConfig(),
    getEmbeddingConfig(),
    getChatCommand(),
    getEmbeddingCommand(),
  ]);

  chatBaseUrl.value = chatCfg.baseUrl;
  chatModel.value = chatCfg.model;
  embeddingBaseUrl.value = embeddingCfg.baseUrl;
  embeddingModel.value = embeddingCfg.model;
  chatCommand.value = chatCmd;
  embeddingCommand.value = embeddingCmd;

  loading.value = false;

  await Promise.all([refresh('chat'), refresh('embedding')]);
});

/* ── Detectar estado atual ─────────────────────────────────────────── */

function isStopped(status: LlamaServerStatus): boolean {
  return status === 'parado' || status === 'erro';
}

async function refresh(kind: LlamaServerKind): Promise<void> {
  const isChat = kind === 'chat';
  const baseUrl = isChat ? chatBaseUrl.value : embeddingBaseUrl.value;
  const result = await detectServerStatus(kind, baseUrl, embeddingModel.value);

  if (isChat) {
    chatStatus.value = result.status;
    chatError.value = result.error ?? '';
    chatOwned.value = await isServerOwned('chat');
  } else {
    embeddingStatus.value = result.status;
    embeddingError.value = result.error ?? '';
    embeddingOwned.value = await isServerOwned('embedding');
  }
}

/* ── Iniciar servidor ──────────────────────────────────────────────── */

async function launch(kind: LlamaServerKind): Promise<void> {
  const isChat = kind === 'chat';
  const baseUrl = isChat ? chatBaseUrl.value : embeddingBaseUrl.value;
  const rawCommand = isChat ? chatCommand.value : embeddingCommand.value;
  // O MCP e necessario apenas para a consulta a web; embeddings nao usam tools.
  const command = isChat ? await withMcpServersConfig(rawCommand) : rawCommand;
  const currentStatus = isChat ? chatStatus.value : embeddingStatus.value;

  if (isChat) {
    chatStatus.value = 'iniciando';
    chatWarning.value = '';
  } else {
    embeddingStatus.value = 'iniciando';
    embeddingWarning.value = '';
  }
  busy.value = true;

  try {
    const result = await startServer(
      kind,
      baseUrl,
      command,
      currentStatus,
      embeddingModel.value,
    );

    if (isChat) {
      chatStatus.value = result.status;
      chatError.value = result.error ?? '';
      chatWarning.value = result.warning ?? '';
      chatOwned.value = await isServerOwned('chat');
    } else {
      embeddingStatus.value = result.status;
      embeddingError.value = result.error ?? '';
      embeddingWarning.value = result.warning ?? '';
      embeddingOwned.value = await isServerOwned('embedding');
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (isChat) {
      chatStatus.value = 'erro';
      chatError.value = message;
    } else {
      embeddingStatus.value = 'erro';
      embeddingError.value = message;
    }
  } finally {
    busy.value = false;
  }
}

async function launchAll(): Promise<void> {
  const currentChatStatus = chatStatus.value;
  const currentEmbeddingStatus = embeddingStatus.value;

  busy.value = true;
  if (shouldLaunchServer(currentChatStatus)) {
    chatStatus.value = 'iniciando';
    chatWarning.value = '';
  }
  if (shouldLaunchServer(currentEmbeddingStatus)) {
    embeddingStatus.value = 'iniciando';
    embeddingWarning.value = '';
  }

  try {
    const results = await startServers([
      {
        kind: 'chat',
        baseUrl: chatBaseUrl.value,
        command: await withMcpServersConfig(chatCommand.value),
        status: currentChatStatus,
        embeddingModel: embeddingModel.value,
      },
      {
        kind: 'embedding',
        baseUrl: embeddingBaseUrl.value,
        command: embeddingCommand.value,
        status: currentEmbeddingStatus,
        embeddingModel: embeddingModel.value,
      },
    ]);

    chatStatus.value = results.chat.status;
    chatError.value = results.chat.error ?? '';
    chatWarning.value = results.chat.warning ?? '';
    embeddingStatus.value = results.embedding.status;
    embeddingError.value = results.embedding.error ?? '';
    embeddingWarning.value = results.embedding.warning ?? '';
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (shouldLaunchServer(currentChatStatus)) {
      chatStatus.value = 'erro';
      chatError.value = message;
    }
    if (shouldLaunchServer(currentEmbeddingStatus)) {
      embeddingStatus.value = 'erro';
      embeddingError.value = message;
    }
  } finally {
    busy.value = false;
  }

  chatOwned.value = await isServerOwned('chat');
  embeddingOwned.value = await isServerOwned('embedding');
}

/* ── Parar servidor ────────────────────────────────────────────────── */

async function stop(kind: LlamaServerKind): Promise<void> {
  const isChat = kind === 'chat';
  const previousStatus = isChat ? chatStatus.value : embeddingStatus.value;
  const url = isChat ? chatBaseUrl.value : embeddingBaseUrl.value;

  // Estado intermediário: impede um novo start enquanto o processo ainda está saindo.
  busy.value = true;
  if (isChat) {
    chatStatus.value = 'encerrando';
    chatError.value = '';
    chatWarning.value = '';
  } else {
    embeddingStatus.value = 'encerrando';
    embeddingError.value = '';
    embeddingWarning.value = '';
  }

  try {
    // O backend só responde depois de confirmar: processo morto + porta livre.
    const stopped = await stopServer(kind, portFromUrl(url));
    if (!stopped) {
      // Processo não é desta sessão (ou já saiu): mantém o estado anterior.
      if (isChat) chatStatus.value = previousStatus;
      else embeddingStatus.value = previousStatus;
      return;
    }

    if (isChat) {
      chatStatus.value = 'parado';
      chatError.value = '';
      chatOwned.value = false;
      chatTestResult.value = '';
    } else {
      embeddingStatus.value = 'parado';
      embeddingError.value = '';
      embeddingOwned.value = false;
      embeddingTestResult.value = '';
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (isChat) {
      chatStatus.value = 'erro';
      chatError.value = message;
      chatOwned.value = await isServerOwned('chat');
    } else {
      embeddingStatus.value = 'erro';
      embeddingError.value = message;
      embeddingOwned.value = await isServerOwned('embedding');
    }
  } finally {
    busy.value = false;
  }
}

/* ── Testar conexão ────────────────────────────────────────────────── */

async function handleTest(kind: LlamaServerKind): Promise<void> {
  const isChat = kind === 'chat';

  if (isChat) {
    testingChat.value = true;
    chatTestResult.value = '';
    chatError.value = '';
  } else {
    testingEmbedding.value = true;
    embeddingTestResult.value = '';
    embeddingError.value = '';
  }

  try {
    if (isChat) {
      const ok = await probeServer(chatBaseUrl.value);
      chatTestResult.value = ok ? '✓ Conectado' : '';
      if (!ok) chatError.value = 'Servidor não respondeu.';
    } else {
      const result: ConnectionTestResult = await testEmbeddingConnection(
        embeddingBaseUrl.value,
        embeddingModel.value,
      );
      if (result.success) {
        embeddingTestResult.value = result.dimensions
          ? `✓ Conectado · ${result.dimensions} dimensões`
          : '✓ Conectado';
      } else {
        embeddingError.value = result.error ?? 'Não foi possível validar o servidor de embeddings.';
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (isChat) chatError.value = message;
    else embeddingError.value = message;
  } finally {
    if (isChat) testingChat.value = false;
    else testingEmbedding.value = false;
  }
}

function handleClose() {
  if (chatDebounce) {
    clearTimeout(chatDebounce);
    chatDebounce = null;
    void setChatCommand(chatCommand.value);
  }
  if (embeddingDebounce) {
    clearTimeout(embeddingDebounce);
    embeddingDebounce = null;
    void setEmbeddingCommand(embeddingCommand.value);
  }
  emit('close');
}
</script>


<template>
  <Teleport to="body">
    <!-- Sem @click.self: o modal fecha apenas pelo botão "✕". -->
    <div class="modal-overlay">
      <div class="ai-config-modal">
        <div class="modal-header">
          <div class="modal-title">
            <span class="title-icon">&#129693;</span>
            <h2>Servidores locais</h2>
          </div>
          <button class="close-btn" @click="handleClose">&#10005;</button>
        </div>

        <div v-if="loading" class="loading-hint">Carregando configuração...</div>

        <template v-else>
          <!-- Chat -->
          <div class="config-card">
            <div class="card-header">
              <div class="card-identity">
                <span class="card-title">{{ chatModel ? `Chat · ${chatModel}` : 'Chat / LLM' }}</span>
                <span class="card-url">{{ chatBaseUrl }}</span>
              </div>
              <span class="server-status" :class="chatStatus">
                {{ SERVER_STATUS_LABELS[chatStatus] }}
              </span>
            </div>

            <textarea
              v-model="chatCommand"
              rows="3"
              class="command-input"
              spellcheck="false"
            />

            <p v-if="chatTestResult" class="test-success">{{ chatTestResult }}</p>
            <p v-if="chatError" class="server-error">{{ chatError }}</p>
            <p v-if="chatWarning" class="server-warning">{{ chatWarning }}</p>

            <div class="action-row">
              <button
                class="btn-action btn-start"
                :disabled="busy || !isStopped(chatStatus)"
                @click="launch('chat')"
              >
                Iniciar
              </button>
              <button
                class="btn-action btn-test"
                :disabled="testingChat || busy"
                @click="handleTest('chat')"
              >
                {{ testingChat ? 'Testando...' : 'Testar' }}
              </button>
              <button
                v-if="chatOwned"
                class="btn-action btn-stop"
                :disabled="busy"
                @click="stop('chat')"
              >
                Parar
              </button>
            </div>
          </div>

          <!-- Embeddings -->
          <div class="config-card">
            <div class="card-header">
              <div class="card-identity">
                <span class="card-title">{{ embeddingModel ? `Embeddings · ${embeddingModel}` : 'Embeddings' }}</span>
                <span class="card-url">{{ embeddingBaseUrl }}</span>
              </div>
              <span class="server-status" :class="embeddingStatus">
                {{ SERVER_STATUS_LABELS[embeddingStatus] }}
              </span>
            </div>

            <textarea
              v-model="embeddingCommand"
              rows="3"
              class="command-input"
              spellcheck="false"
            />

            <p v-if="embeddingTestResult" class="test-success">{{ embeddingTestResult }}</p>
            <p v-if="embeddingError" class="server-error">{{ embeddingError }}</p>
            <p v-if="embeddingWarning" class="server-warning">{{ embeddingWarning }}</p>

            <div class="action-row">
              <button
                class="btn-action btn-start"
                :disabled="busy || !isStopped(embeddingStatus)"
                @click="launch('embedding')"
              >
                Iniciar
              </button>
              <button
                class="btn-action btn-test"
                :disabled="testingEmbedding || busy"
                @click="handleTest('embedding')"
              >
                {{ testingEmbedding ? 'Testando...' : 'Testar' }}
              </button>
              <button
                v-if="embeddingOwned"
                class="btn-action btn-stop"
                :disabled="busy"
                @click="stop('embedding')"
              >
                Parar
              </button>
            </div>
          </div>

          <!-- Ação global -->
          <button class="btn-start-all" :disabled="busy" @click="launchAll">
            {{ busy ? 'Iniciando...' : 'Iniciar servidores' }}
          </button>
        </template>
      </div>
    </div>
  </Teleport>
</template>


<style scoped>
.loading-hint {
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.modal-overlay {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100000;
  backdrop-filter: blur(8px);
  padding: 20px;
  overflow-y: auto;
  box-sizing: border-box;
}

.ai-config-modal {
  background: var(--panel-bg);
  backdrop-filter: blur(16px);
  border: 1px solid var(--accent);
  border-radius: 16px;
  padding: 24px;
  max-width: 520px;
  width: 100%;
  max-height: calc(100vh - 40px);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin: auto;
  box-shadow: 0 25px 60px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(56, 189, 248, 0.25);
  box-sizing: border-box;
}

/* ── Header ─────────────────────────────────────────────────────── */

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

/* ── Config Card ────────────────────────────────────────────────── */

.config-card {
  background: rgba(15, 23, 42, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.card-identity {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.card-title {
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--text-primary);
}

.card-url {
  font-family: monospace;
  font-size: 0.7rem;
  color: var(--text-secondary);
}

/* ── Status ─────────────────────────────────────────────────────── */

.server-status {
  font-size: 0.75rem;
  font-weight: 600;
  white-space: nowrap;
  flex-shrink: 0;
}

.server-status.parado {
  color: var(--text-secondary);
}

.server-status.iniciando,
.server-status.encerrando {
  color: #f59e0b;
}

.server-status.executando {
  color: #10b981;
}

.server-status.erro {
  color: #ef4444;
}

/* ── Comando ────────────────────────────────────────────────────── */

.command-input {
  width: 100%;
  box-sizing: border-box;
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 8px 10px;
  color: var(--text-primary);
  font-family: monospace;
  font-size: 0.75rem;
  resize: vertical;
  line-height: 1.5;
}

.command-input:focus {
  outline: none;
  border-color: var(--accent);
}

/* ── Mensagens ──────────────────────────────────────────────────── */

.test-success {
  margin: 0;
  font-size: 0.75rem;
  color: #10b981;
  font-weight: 600;
}

.server-error {
  margin: 0;
  padding: 8px 10px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 8px;
  color: #fca5a5;
  font-size: 0.75rem;
  line-height: 1.4;
  white-space: pre-wrap;
}

.server-warning {
  margin: 0;
  padding: 8px 10px;
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid rgba(245, 158, 11, 0.3);
  border-radius: 8px;
  color: #fcd34d;
  font-size: 0.75rem;
  line-height: 1.4;
  white-space: pre-wrap;
}

/* ── Botões de ação ─────────────────────────────────────────────── */

.action-row {
  display: flex;
  gap: 8px;
}

.btn-action {
  border-radius: 8px;
  padding: 7px 14px;
  font-weight: 600;
  font-size: 0.8rem;
  cursor: pointer;
  transition: opacity 0.15s;
}

.btn-action:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.btn-start {
  background: var(--accent);
  border: none;
  color: #0f172a;
}

.btn-test {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text-primary);
}

.btn-test:not(:disabled):hover {
  border-color: var(--accent);
  color: var(--accent);
}

.btn-stop {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text-secondary);
}

.btn-stop:not(:disabled):hover {
  border-color: #ef4444;
  color: #ef4444;
}

/* ── Botão global ───────────────────────────────────────────────── */

.btn-start-all {
  width: 100%;
  background: var(--accent);
  border: none;
  border-radius: 10px;
  padding: 10px 14px;
  color: #0f172a;
  font-weight: 700;
  font-size: 0.85rem;
  cursor: pointer;
  transition: opacity 0.15s;
}

.btn-start-all:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
