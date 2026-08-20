<script setup lang="ts">
import { computed } from 'vue';
import { notesStore } from '../store/notesStore';
import { Chart as ChartJS, Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale, PointElement, LineElement, Filler } from 'chart.js';
import { Line } from 'vue-chartjs';

ChartJS.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale, PointElement, LineElement, Filler);

const emit = defineEmits<{
  clearAll: [];
}>();

const PT_STOPWORDS = new Set([
  'de', 'a', 'o', 'que', 'e', 'do', 'da', 'em', 'um', 'para', 'é', 'com', 'não', 'uma',
  'os', 'no', 'se', 'na', 'por', 'mais', 'as', 'dos', 'como', 'mas', 'foi', 'ao', 'ele',
  'das', 'tem', 'à', 'seu', 'sua', 'ou', 'ser', 'quando', 'muito', 'há', 'nos', 'já',
  'está', 'eu', 'também', 'só', 'pelo', 'pela', 'até', 'isso', 'ela', 'entre', 'era',
  'depois', 'sem', 'mesmo', 'aos', 'ter', 'seus', 'quem', 'nas', 'me', 'esse', 'eles',
  'estão', 'você', 'tinha', 'foram', 'essa', 'num', 'nem', 'suas', 'meu', 'às', 'minha',
  'têm', 'numa', 'pelos', 'elas', 'havia', 'seja', 'qual', 'será', 'nós', 'tenho', 'lhe',
  'deles', 'essas', 'esses', 'pelas', 'este', 'fosse', 'dele', 'tu', 'te', 'vocês', 'vos',
  'lhes', 'meus', 'minhas', 'teu', 'tua', 'teus', 'tuas', 'nosso', 'nossa', 'nossos', 'nossas',
  'dela', 'delas', 'esta', 'estes', 'estas', 'aquele', 'aquela', 'aqueles', 'aquelas', 'isto',
  'aquilo', 'sobre', 'onde', 'qual', 'quais', 'nota', 'notas'
]);

const notesThisWeek = computed(() => {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  return notesStore.notes.filter(note => new Date(note.created_at) > weekAgo).length;
});

const pinnedCount = computed(() => {
  return notesStore.notes.filter(n => n.pinned).length;
});

const allTagsCount = computed(() => {
  const set = new Set<string>();
  for (const note of notesStore.notes) {
    if (note.tags) {
      note.tags.split(',').forEach(t => {
        const clean = t.trim().toLowerCase();
        if (clean) set.add(clean);
      });
    }
  }
  return set.size;
});

const topKeywords = computed(() => {
  const counts: Record<string, number> = {};
  for (const note of notesStore.notes) {
    const cleanContent = note.content
      .replace(/https?:\/\/[^\s]+/g, '')
      .replace(/[A-Za-z]:[^\s]+/g, '')
      .replace(/[^\wÀ-ÿ\s]/g, ' ')
      .toLowerCase();

    const words = cleanContent.split(/\s+/).filter(w => w.length >= 3);
    for (const w of words) {
      if (!PT_STOPWORDS.has(w) && !/^\d+$/.test(w)) {
        counts[w] = (counts[w] || 0) + 1;
      }
    }
  }

  return Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10);
});

// Activity for the last 7 days
const activityChartData = computed(() => {
  const days: string[] = [];
  const counts: number[] = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dayStr = d.toISOString().split('T')[0];
    const label = d.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric' });

    days.push(label);
    const count = notesStore.notes.filter(n => n.created_at.startsWith(dayStr)).length;
    counts.push(count);
  }

  return {
    labels: days,
    datasets: [
      {
        label: 'Notas criadas',
        backgroundColor: 'rgba(56, 189, 248, 0.2)',
        borderColor: '#38bdf8',
        borderWidth: 2,
        pointBackgroundColor: '#38bdf8',
        tension: 0.3,
        fill: true,
        data: counts,
      },
    ],
  };
});

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: false,
    },
    tooltip: {
      backgroundColor: '#1e293b',
      titleColor: '#f8fafc',
      bodyColor: '#38bdf8',
      borderColor: 'rgba(255, 255, 255, 0.1)',
      borderWidth: 1,
    },
  },
  scales: {
    y: {
      beginAtZero: true,
      ticks: {
        stepSize: 1,
        color: '#94a3b8',
      },
      grid: {
        color: 'rgba(255, 255, 255, 0.05)',
      },
    },
    x: {
      ticks: {
        color: '#94a3b8',
      },
      grid: {
        display: false,
      },
    },
  },
};
</script>

<template>
  <div class="insights-container">
    <!-- Stat Cards -->
    <div class="stats-grid">
      <div class="stat-card">
        <span class="stat-icon">📝</span>
        <div class="stat-info">
          <span class="stat-value">{{ notesStore.notes.length }}</span>
          <span class="stat-label">Total de notas</span>
        </div>
      </div>

      <div class="stat-card">
        <span class="stat-icon">📅</span>
        <div class="stat-info">
          <span class="stat-value">{{ notesThisWeek }}</span>
          <span class="stat-label">Esta semana</span>
        </div>
      </div>

      <div class="stat-card">
        <span class="stat-icon">🔥</span>
        <div class="stat-info">
          <span class="stat-value">{{ notesStore.stats.streak }}</span>
          <span class="stat-label">Dias seguidos</span>
        </div>
      </div>

      <div class="stat-card">
        <span class="stat-icon">📌</span>
        <div class="stat-info">
          <span class="stat-value">{{ pinnedCount }}</span>
          <span class="stat-label">Notas fixadas</span>
        </div>
      </div>

      <div class="stat-card">
        <span class="stat-icon">🏷️</span>
        <div class="stat-info">
          <span class="stat-value">{{ allTagsCount }}</span>
          <span class="stat-label">Tags únicas</span>
        </div>
      </div>
    </div>

    <!-- Chart Activity -->
    <section class="panel chart-panel">
      <h3>Atividade Recente (Últimos 7 dias)</h3>
      <div class="chart-wrapper">
        <Line :data="activityChartData" :options="chartOptions" />
      </div>
    </section>

    <!-- Top Keywords & Categories -->
    <section class="panel keywords-panel">
      <h3>Tópicos & Palavras-chave Mais Frequentes</h3>
      <p v-if="!topKeywords.length" class="empty-text">Adicione mais notas para gerar a nuvem de palavras-chave.</p>
      <div v-else class="keywords-cloud">
        <div
          v-for="([word, count]) in topKeywords"
          :key="word"
          class="keyword-pill"
          :style="{ fontSize: `${Math.min(1.2, 0.85 + count * 0.08)}rem` }"
        >
          <span class="word-text">{{ word }}</span>
          <span class="word-count">{{ count }}</span>
        </div>
      </div>
    </section>

    <!-- Danger Zone -->
    <section class="panel danger-panel">
      <h3>Gerenciamento de Dados</h3>
      <p class="danger-desc">Exclui permanentemente todas as memórias e o cache de busca vetorial local.</p>
      <button type="button" class="btn-danger" @click="emit('clearAll')">
        🗑️ Excluir Todas as Notas
      </button>
    </section>
  </div>
</template>

<style scoped>
.insights-container {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 14px;
}

.stat-card {
  background: var(--panel-bg);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  backdrop-filter: blur(12px);
  transition: transform 0.2s, border-color 0.2s;
}

.stat-card:hover {
  transform: translateY(-2px);
  border-color: rgba(56, 189, 248, 0.4);
}

.stat-icon {
  font-size: 1.8rem;
}

.stat-info {
  display: flex;
  flex-direction: column;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 800;
  color: var(--text-primary);
  line-height: 1.2;
}

.stat-label {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.chart-panel h3, .keywords-panel h3, .danger-panel h3 {
  margin: 0 0 16px 0;
  font-size: 1.1rem;
}

.chart-wrapper {
  height: 220px;
  position: relative;
}

.keywords-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.keyword-pill {
  background: rgba(56, 189, 248, 0.1);
  border: 1px solid rgba(56, 189, 248, 0.25);
  border-radius: 20px;
  padding: 6px 14px;
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--accent);
  transition: all 0.2s;
}

.keyword-pill:hover {
  background: rgba(56, 189, 248, 0.2);
  transform: scale(1.05);
}

.word-count {
  background: rgba(56, 189, 248, 0.3);
  color: white;
  border-radius: 10px;
  font-size: 0.65rem;
  font-weight: 700;
  padding: 1px 6px;
}

.empty-text {
  color: var(--text-secondary);
  font-size: 0.85rem;
  margin: 0;
}

.danger-panel {
  border-color: rgba(239, 68, 68, 0.3);
  background: rgba(239, 68, 68, 0.03);
}

.danger-desc {
  font-size: 0.85rem;
  color: var(--text-secondary);
  margin: 0 0 16px 0;
}

.btn-danger {
  background: rgba(239, 68, 68, 0.15);
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.3);
  padding: 10px 18px;
  border-radius: 8px;
  font-weight: 600;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-danger:hover {
  background: rgba(239, 68, 68, 0.3);
}
</style>
