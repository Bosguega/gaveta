<script setup lang="ts">
import { ref } from 'vue';
import AiConfigModal from '../components/AiConfigModal.vue';
import { exportNotesJson, importNotesJson, listNotes } from '../services/databaseService';
import { notesStore, showToast } from '../store/notesStore';

const emit = defineEmits<{
  saved: [];
  notesReloaded: [];
}>();

const showAiConfig = ref(false);
const fileInputRef = ref<HTMLInputElement | null>(null);
const isExporting = ref(false);
const isImporting = ref(false);

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

async function handleExport() {
  isExporting.value = true;
  try {
    const json = await exportNotesJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateStr = new Date().toISOString().split('T')[0];
    a.href = url;
    a.download = `memoria_auxiliar_backup_${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Backup exportado com sucesso!', 'success');
  } catch (error) {
    console.error('Erro ao exportar backup:', error);
    showToast('Falha ao exportar backup.', 'error');
  } finally {
    isExporting.value = false;
  }
}

function triggerImport() {
  fileInputRef.value?.click();
}

async function handleFileChange(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  isImporting.value = true;
  try {
    const text = await file.text();
    const count = await importNotesJson(text);
    notesStore.notes = await listNotes();
    showToast(`${count} notas importadas com sucesso!`, 'success');
    emit('notesReloaded');
  } catch (error) {
    console.error('Erro ao importar backup:', error);
    showToast('Arquivo de backup inválido.', 'error');
  } finally {
    isImporting.value = false;
    if (fileInputRef.value) fileInputRef.value.value = '';
  }
}
</script>

<template>
  <section class="panel settings-panel">
    <h2>Configurações</h2>

    <div class="settings-form">
      <!-- AI Configuration Card -->
      <div class="settings-card" @click="openAiConfig">
        <div class="card-icon">🤖</div>
        <div class="card-body">
          <strong>Inteligência Artificial</strong>
          <p>Configurar API key, modelo, provedor online ou local (Ollama)</p>
        </div>
        <span class="card-arrow">→</span>
      </div>

      <!-- Backup & Restore Section -->
      <div class="settings-section">
        <h3>Backup & Restauração</h3>
        <p class="section-desc">Exporte suas notas para backup ou transfira para outro computador.</p>
        
        <div class="backup-actions">
          <button class="btn-backup" :disabled="isExporting" @click="handleExport">
            📥 {{ isExporting ? 'Exportando...' : 'Exportar Backup (JSON)' }}
          </button>
          
          <button class="btn-backup secondary" :disabled="isImporting" @click="triggerImport">
            📤 {{ isImporting ? 'Importando...' : 'Importar Backup (JSON)' }}
          </button>
          
          <input
            ref="fileInputRef"
            type="file"
            accept=".json"
            style="display: none"
            @change="handleFileChange"
          />
        </div>
      </div>

      <!-- Keyboard Shortcuts Section -->
      <div class="settings-section">
        <h3>Atalhos de Teclado</h3>
        <div class="shortcuts-grid">
          <div class="shortcut-item">
            <span class="shortcut-desc">Focar busca</span>
            <kbd>Ctrl + F</kbd>
          </div>
          <div class="shortcut-item">
            <span class="shortcut-desc">Salvar nota no formulário</span>
            <kbd>Ctrl + S</kbd>
          </div>
          <div class="shortcut-item">
            <span class="shortcut-desc">Cancelar edição</span>
            <kbd>Esc</kbd>
          </div>
          <div class="shortcut-item">
            <span class="shortcut-desc">Alternar para Pesquisar</span>
            <kbd>Ctrl + 1</kbd>
          </div>
          <div class="shortcut-item">
            <span class="shortcut-desc">Alternar para Incluir Dicas</span>
            <kbd>Ctrl + 2</kbd>
          </div>
          <div class="shortcut-item">
            <span class="shortcut-desc">Alternar para Conversar (RAG)</span>
            <kbd>Ctrl + 3</kbd>
          </div>
          <div class="shortcut-item">
            <span class="shortcut-desc">Alternar para Insights</span>
            <kbd>Ctrl + 4</kbd>
          </div>
          <div class="shortcut-item">
            <span class="shortcut-desc">Alternar para Configurações</span>
            <kbd>Ctrl + 5</kbd>
          </div>
        </div>
      </div>

      <div class="info-box">
        <p>
          O app armazena todas as notas localmente em SQLite e usa busca por similaridade de cosseno com embeddings de 1024 dimensões.
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
  max-width: 580px;
  margin: 0 auto;
}

.settings-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
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

.settings-section {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 18px;
}

.settings-section h3 {
  margin: 0 0 6px 0;
  font-size: 0.95rem;
  color: var(--text-primary);
}

.section-desc {
  font-size: 0.8rem;
  color: var(--text-secondary);
  margin: 0 0 14px 0;
}

.backup-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.btn-backup {
  background: rgba(56, 189, 248, 0.15);
  color: var(--accent);
  border: 1px solid rgba(56, 189, 248, 0.3);
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-backup:hover:not(:disabled) {
  background: rgba(56, 189, 248, 0.25);
}

.btn-backup.secondary {
  background: rgba(255, 255, 255, 0.05);
  border-color: var(--border);
  color: var(--text-primary);
}

.btn-backup.secondary:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.1);
}

.btn-backup:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.shortcuts-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.shortcut-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 10px;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 6px;
}

.shortcut-desc {
  font-size: 0.8rem;
  color: var(--text-secondary);
}

kbd {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 4px;
  padding: 2px 6px;
  font-size: 0.75rem;
  font-family: inherit;
  color: var(--text-primary);
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