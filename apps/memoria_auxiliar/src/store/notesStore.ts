import { reactive } from 'vue';
import type { ApiErrorLike } from '@bosguega/ai-core';
import type { AppTheme, ChatMessage, ChatSession, ClipboardAnalysis, Note, SearchResult, Stats, ToastNotification } from '../types';
import { tauriStore } from '../services/tauriStore';

function getTodayString() {
  return new Date().toISOString().split('T')[0];
}

function getYesterdayString() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday.toISOString().split('T')[0];
}

async function loadStats(): Promise<Stats> {
  try {
    const tauriVal = await tauriStore.preferences.get('memoria_auxiliar_stats');
    if (tauriVal) {
      const parsed = JSON.parse(tauriVal);
      return { streak: parsed.streak ?? 0, lastUse: parsed.lastUse ?? null };
    }
  } catch {
    // Fallback to localStorage
  }

  const stored = localStorage.getItem('memoria_auxiliar_stats');
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      return { streak: parsed.streak ?? 0, lastUse: parsed.lastUse ?? null };
    } catch {
      return { streak: 0, lastUse: null };
    }
  }
  return { streak: 0, lastUse: null };
}

async function saveStats(stats: Stats) {
  const json = JSON.stringify(stats);
  localStorage.setItem('memoria_auxiliar_stats', json);
  try {
    await tauriStore.preferences.set('memoria_auxiliar_stats', json);
  } catch {
    // Silently ignore if not in Tauri
  }
}

export async function initStats() {
  const loaded = await loadStats();
  notesStore.stats.streak = loaded.streak;
  notesStore.stats.lastUse = loaded.lastUse;
}

export function updateStreak() {
  const today = getTodayString();
  if (notesStore.stats.lastUse !== today) {
    if (notesStore.stats.lastUse === getYesterdayString()) {
      notesStore.stats.streak += 1;
    } else {
      notesStore.stats.streak = 1;
    }
    notesStore.stats.lastUse = today;
    saveStats(notesStore.stats);
  }
}

export function resetStats() {
  notesStore.stats.streak = 0;
  notesStore.stats.lastUse = null;
  saveStats(notesStore.stats);
}

export function navigateTo(targetView: typeof notesStore.activeView) {
  if (notesStore.activeView === 'add' && notesStore.formDirtyContent && targetView !== 'add') {
    notesStore.confirmModal.message = 'Você possui alterações não salvas no formulário. Deseja sair mesmo assim?';
    notesStore.confirmModal.onConfirm = () => {
      notesStore.formDirtyContent = '';
      notesStore.editingNote = null;
      notesStore.activeView = targetView;
    };
    notesStore.confirmModal.show = true;
    return;
  }
  notesStore.activeView = targetView;
}

// ── Theme Management ──

export async function initTheme() {
  let theme: AppTheme = 'dark';
  try {
    const saved = (await tauriStore.preferences.get('memoria_auxiliar_theme')) as AppTheme | null;
    if (saved) theme = saved;
  } catch {
    const local = localStorage.getItem('memoria_auxiliar_theme') as AppTheme | null;
    if (local) theme = local;
  }
  setTheme(theme);
}

export async function setTheme(theme: AppTheme) {
  notesStore.theme = theme;
  if (theme === 'dark') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', theme);
  }
  localStorage.setItem('memoria_auxiliar_theme', theme);
  try {
    await tauriStore.preferences.set('memoria_auxiliar_theme', theme);
  } catch {
    // Silently ignore
  }
}

// ── Smart Clipboard Analysis ──

export function analyzeClipboardContent(text: string): ClipboardAnalysis {
  const trimmed = text.trim();
  const tags: string[] = [];

  // URL detection
  if (/^https?:\/\/[^\s]+$/i.test(trimmed)) {
    tags.push('link', 'web');
    return {
      type: 'url',
      original: trimmed,
      formatted: `[Link: ${trimmed}](${trimmed})`,
      suggestedTags: tags,
    };
  }

  // Windows Path detection
  if (/^[A-Za-z]:\\[^\s<>:"|?*\n]+/i.test(trimmed)) {
    tags.push('caminho', 'arquivo');
    return {
      type: 'path',
      original: trimmed,
      formatted: trimmed,
      suggestedTags: tags,
    };
  }

  // Code snippet detection (heuristic)
  const isCode =
    trimmed.includes('import ') ||
    trimmed.includes('export ') ||
    trimmed.includes('const ') ||
    trimmed.includes('function ') ||
    trimmed.includes('def ') ||
    trimmed.includes('class ') ||
    trimmed.includes('SELECT ') ||
    trimmed.includes('FROM ') ||
    (trimmed.includes('{') && trimmed.includes('}')) ||
    (trimmed.includes('=>') && trimmed.includes(';'));

  if (isCode) {
    tags.push('codigo', 'snippet');
    return {
      type: 'code',
      original: trimmed,
      formatted: `\`\`\`\n${trimmed}\n\`\`\``,
      suggestedTags: tags,
    };
  }

  // Plain text
  return {
    type: 'text',
    original: trimmed,
    formatted: trimmed,
    suggestedTags: tags,
  };
}

let toastTimer: ReturnType<typeof setTimeout> | null = null;

export function showToast(message: string, type: 'success' | 'info' | 'error' = 'success', duration = 3000) {
  if (toastTimer) clearTimeout(toastTimer);
  notesStore.toast.message = message;
  notesStore.toast.type = type;
  notesStore.toast.show = true;

  toastTimer = setTimeout(() => {
    notesStore.toast.show = false;
  }, duration);
}

export const notesStore = reactive({
  theme: 'dark' as AppTheme,
  quickCaptureOpen: false,
  notes: [] as Note[],
  results: [] as SearchResult[],
  editingNote: null as Note | null,
  formDirtyContent: '' as string,
  selectedTag: null as string | null,
  messages: [] as ChatMessage[],
  chatSessions: [] as ChatSession[],
  currentSessionId: null as number | null,
  summary: '',
  loading: false,
  loadingMessage: '',
  error: null as ApiErrorLike | null,
  activeView: 'search' as 'search' | 'add' | 'chat' | 'insights' | 'settings',
  searchFallbackMode: false,
  confirmModal: {
    show: false,
    message: '',
    onConfirm: (() => { }) as () => void,
  },
  toast: {
    show: false,
    message: '',
    type: 'success' as 'success' | 'info' | 'error',
  } as ToastNotification,
  stats: reactive({
    streak: 0,
    lastUse: null as string | null,
  }),
});
