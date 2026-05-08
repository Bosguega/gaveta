<script setup lang="ts">
import { computed, ref } from 'vue';
import { open } from '@tauri-apps/plugin-shell';
import {
  parseInteractiveContent,
  extractFileName,
  isExecutablePath,
  isDirectoryPath,
} from '../utils/parseInteractiveContent';
import type { InteractiveSegment } from '../types';

const props = withDefaults(
  defineProps<{
    text: string;
    class?: string;
  }>(),
  {
    class: '',
  },
);

const showConfirm = ref(false);
const pendingPath = ref('');
const pendingFileName = ref('');

function getSegmentIcon(segment: InteractiveSegment): string {
  if (segment.type === 'url') return '\u{1F310}';
  if (segment.type === 'path') {
    const value = segment.value;
    if (isExecutablePath(value)) return '\u{1F5A5}';
    if (isDirectoryPath(value)) return '\u{1F4C1}';
    return '\u{1F4C4}';
  }
  return '';
}

function getSegmentLabel(segment: InteractiveSegment): string {
  if (segment.type === 'url') return 'Link';
  if (segment.type === 'path') {
    const value = segment.value;
    if (isExecutablePath(value)) return 'Execut\u00E1vel';
    if (isDirectoryPath(value)) return 'Pasta';
    return 'Arquivo';
  }
  return '';
}

function handleClick(event: MouseEvent, segment: InteractiveSegment) {
  if (!event.ctrlKey) return;

  event.preventDefault();
  event.stopPropagation();

  if (segment.type === 'url') {
    openUrl(segment.value);
  } else if (segment.type === 'path') {
    if (isExecutablePath(segment.value)) {
      // Mostra modal de confirmação para executáveis
      pendingPath.value = segment.value;
      pendingFileName.value = extractFileName(segment.value);
      showConfirm.value = true;
    } else {
      openPath(segment.value);
    }
  }
}

function handleKeydown(event: KeyboardEvent, segment: InteractiveSegment) {
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
    handleClick(event as unknown as MouseEvent, segment);
  }
}

async function openUrl(url: string) {
  try {
    await open(url);
  } catch (error) {
    console.error('Erro ao abrir URL:', error);
  }
}

async function openPath(path: string) {
  try {
    await open(path);
  } catch (error) {
    console.error('Erro ao abrir caminho:', error);
  }
}

function confirmOpen() {
  if (pendingPath.value) {
    openPath(pendingPath.value);
  }
  cancelConfirm();
}

function cancelConfirm() {
  showConfirm.value = false;
  pendingPath.value = '';
  pendingFileName.value = '';
}

const segments = computed(() => parseInteractiveContent(props.text));
</script>

<template>
  <span :class="['interactive-content', $attrs.class as string]">
    <template v-for="(segment, index) in segments" :key="index">
      <span v-if="segment.type === 'text'" class="text-segment">{{ segment.value }}</span>

      <span
        v-else
        :class="['interactive-link', segment.type]"
        :title="getSegmentLabel(segment) + ' \u2014 CTRL + clique para abrir'"
        :tabindex="0"
        role="link"
        :aria-label="getSegmentLabel(segment) + ': ' + segment.value"
        @click.prevent="handleClick($event, segment)"
        @keydown.enter.prevent="handleKeydown($event, segment)"
      >
        <span class="link-icon">{{ getSegmentIcon(segment) }}</span>
        <span class="link-text">{{ segment.value }}</span>
      </span>
    </template>
  </span>

  <!-- Modal de confirmação para executáveis -->
  <Teleport to="body">
    <div v-if="showConfirm" class="confirm-overlay" @click.self="cancelConfirm">
      <div class="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
        <p id="confirm-title" class="confirm-title">Deseja abrir este aplicativo?</p>
        <div class="confirm-details">
          <p class="confirm-name">{{ pendingFileName }}</p>
          <p class="confirm-path">{{ pendingPath }}</p>
        </div>
        <div class="confirm-actions">
          <button class="confirm-btn cancel" @click="cancelConfirm">Cancelar</button>
          <button class="confirm-btn confirm" @click="confirmOpen">Abrir</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.interactive-content {
  display: inline;
  white-space: pre-wrap;
}

.text-segment {
  display: inline;
}

.interactive-link {
  display: inline;
  cursor: pointer;
  text-decoration: underline;
  text-decoration-style: dotted;
  text-underline-offset: 2px;
  opacity: 0.9;
  transition: opacity 0.1s;
  border-radius: 2px;
  padding: 0 1px;
}

.interactive-link:hover {
  opacity: 1;
  background: rgba(255, 255, 255, 0.06);
}

.interactive-link:focus-visible {
  outline: 2px solid var(--primary-color, #3b82f6);
  outline-offset: 1px;
}

.link-icon {
  margin-right: 2px;
  font-size: 0.85em;
}

.link-text {
  word-break: break-all;
}

/* Modal de confirmação */
.confirm-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.confirm-modal {
  background: #1e1e2e;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 14px;
  padding: 24px 28px;
  max-width: 480px;
  width: 90%;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}

.confirm-title {
  font-size: 1.05rem;
  font-weight: 600;
  margin: 0 0 16px 0;
  color: #fff;
}

.confirm-details {
  background: rgba(255, 255, 255, 0.04);
  border-radius: 10px;
  padding: 14px 16px;
  margin-bottom: 20px;
}

.confirm-name {
  font-size: 0.95rem;
  font-weight: 600;
  margin: 0 0 6px 0;
  color: #e2e8f0;
}

.confirm-path {
  font-size: 0.78rem;
  margin: 0;
  opacity: 0.6;
  word-break: break-all;
  color: #cbd5e1;
}

.confirm-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}

.confirm-btn {
  padding: 8px 20px;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 600;
  border: 1px solid rgba(255, 255, 255, 0.1);
  cursor: pointer;
  transition: all 0.15s;
}

.confirm-btn.cancel {
  background: rgba(255, 255, 255, 0.06);
  color: #e2e8f0;
}

.confirm-btn.cancel:hover {
  background: rgba(255, 255, 255, 0.1);
}

.confirm-btn.confirm {
  background: var(--primary-color, #3b82f6);
  color: white;
  border-color: transparent;
}

.confirm-btn.confirm:hover {
  filter: brightness(1.1);
}
</style>