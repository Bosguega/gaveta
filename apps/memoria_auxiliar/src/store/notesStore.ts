import { reactive } from 'vue';
import type { ApiErrorLike } from '@bosguega/gaveta-de-bagunca';
import type { ChatMessage, Note, SearchResult, Stats } from '../types';

function getTodayString() {
  return new Date().toISOString().split('T')[0];
}

function loadStats(): Stats {
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

function saveStats(stats: Stats) {
  localStorage.setItem('memoria_auxiliar_stats', JSON.stringify(stats));
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

function getYesterdayString() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday.toISOString().split('T')[0];
}

const stats = loadStats();

export const notesStore = reactive({
  notes: [] as Note[],
  results: [] as SearchResult[],
  editingNote: null as Note | null,
  messages: [] as ChatMessage[],
  summary: '',
  loading: false,
  loadingMessage: '',
  error: null as ApiErrorLike | null,
  activeView: 'search' as 'search' | 'add' | 'chat' | 'insights' | 'settings',
  confirmModal: {
    show: false,
    message: '',
    onConfirm: (() => { }) as () => void,
  },
  stats: reactive(stats),
});