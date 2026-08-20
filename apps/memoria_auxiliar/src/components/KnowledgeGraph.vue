<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue';
import { notesStore } from '../store/notesStore';
import type { Note } from '../types';
import { cosineSimilarity } from '../services/similarityService';

const emit = defineEmits<{
  edit: [note: Note];
}>();

const canvasRef = ref<HTMLCanvasElement | null>(null);
const containerRef = ref<HTMLDivElement | null>(null);
const searchQuery = ref('');
const hoveredNode = ref<GraphNode | null>(null);
const selectedNode = ref<GraphNode | null>(null);

interface GraphNode {
  id: number;
  note: Note;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  tags: string[];
  connections: number;
}

interface GraphLink {
  source: GraphNode;
  target: GraphNode;
  weight: number;
  reason: 'semantic' | 'tag';
}

const nodes = ref<GraphNode[]>([]);
const links = ref<GraphLink[]>([]);

// Camera transform (Pan & Zoom)
const transform = ref({
  x: 0,
  y: 0,
  k: 1,
});

let animationFrameId: number | null = null;
let isDragging = false;
let draggedNode: GraphNode | null = null;
let dragStartX = 0;
let dragStartY = 0;
let isPanning = false;
let panStartX = 0;
let panStartY = 0;

// Color palette generator
const TAG_COLORS = [
  '#38bdf8', '#818cf8', '#c084fc', '#f472b6', '#34d399',
  '#fbbf24', '#f87171', '#2dd4bf', '#a78bfa', '#fb923c'
];

function getNodeColor(note: Note, index: number): string {
  if (note.pinned) return '#fbbf24';
  if (note.tags) {
    const firstTag = note.tags.split(',')[0].trim();
    let hash = 0;
    for (let i = 0; i < firstTag.length; i++) hash += firstTag.charCodeAt(i);
    return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
  }
  return TAG_COLORS[index % TAG_COLORS.length];
}

function buildGraph() {
  const noteList = notesStore.notes;
  if (!noteList.length) {
    nodes.value = [];
    links.value = [];
    return;
  }

  const width = containerRef.value?.clientWidth || 800;
  const height = containerRef.value?.clientHeight || 500;

  // 1. Create nodes
  const nodeMap = new Map<number, GraphNode>();
  const createdNodes: GraphNode[] = noteList.map((note, i) => {
    const tags = note.tags ? note.tags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean) : [];
    const angle = (i / noteList.length) * Math.PI * 2;
    const distance = 80 + Math.random() * (Math.min(width, height) / 3);

    const gn: GraphNode = {
      id: note.id,
      note,
      x: width / 2 + Math.cos(angle) * distance,
      y: height / 2 + Math.sin(angle) * distance,
      vx: (Math.random() - 0.5) * 2,
      vy: (Math.random() - 0.5) * 2,
      radius: Math.min(26, Math.max(14, 12 + Math.sqrt(note.content.length) * 0.6)),
      color: getNodeColor(note, i),
      tags,
      connections: 0,
    };
    nodeMap.set(note.id, gn);
    return gn;
  });

  // 2. Create links (Semantic similarity + shared tags)
  const createdLinks: GraphLink[] = [];

  for (let i = 0; i < createdNodes.length; i++) {
    for (let j = i + 1; j < createdNodes.length; j++) {
      const a = createdNodes[i];
      const b = createdNodes[j];

      // Check shared tags
      const sharedTags = a.tags.filter(t => b.tags.includes(t));
      if (sharedTags.length > 0) {
        createdLinks.push({
          source: a,
          target: b,
          weight: 0.5 + Math.min(0.5, sharedTags.length * 0.25),
          reason: 'tag',
        });
        a.connections++;
        b.connections++;
        continue;
      }

      // Check semantic embedding similarity
      const embA = a.note.parsedEmbedding;
      const embB = b.note.parsedEmbedding;
      if (embA && embB && embA.length === embB.length) {
        const score = cosineSimilarity(embA, embB);
        if (score > 0.55) {
          createdLinks.push({
            source: a,
            target: b,
            weight: score,
            reason: 'semantic',
          });
          a.connections++;
          b.connections++;
        }
      }
    }
  }

  nodes.value = createdNodes;
  links.value = createdLinks;
}

// ── Physics Simulation Step ──
function stepPhysics() {
  const nodeArr = nodes.value;
  const linkArr = links.value;
  const width = containerRef.value?.clientWidth || 800;
  const height = containerRef.value?.clientHeight || 500;
  const cx = width / 2;
  const cy = height / 2;

  const kRepulsion = 1200;
  const kSpring = 0.04;
  const centerGravity = 0.015;
  const damping = 0.88;

  // 1. Repulsion between all nodes
  for (let i = 0; i < nodeArr.length; i++) {
    const na = nodeArr[i];

    // Center gravity
    na.vx += (cx - na.x) * centerGravity;
    na.vy += (cy - na.y) * centerGravity;

    for (let j = i + 1; j < nodeArr.length; j++) {
      const nb = nodeArr[j];
      const dx = nb.x - na.x;
      const dy = nb.y - na.y;
      const distSq = dx * dx + dy * dy + 100;
      const dist = Math.sqrt(distSq);

      const force = kRepulsion / distSq;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;

      na.vx -= fx;
      na.vy -= fy;
      nb.vx += fx;
      nb.vy += fy;
    }
  }

  // 2. Attraction along links
  for (const link of linkArr) {
    const na = link.source;
    const nb = link.target;
    const dx = nb.x - na.x;
    const dy = nb.y - na.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const desiredDist = 120 / (link.weight || 0.5);

    const force = (dist - desiredDist) * kSpring * link.weight;
    const fx = (dx / dist) * force;
    const fy = (dy / dist) * force;

    na.vx += fx;
    na.vy += fy;
    nb.vx -= fx;
    nb.vy -= fy;
  }

  // 3. Apply velocity & damping
  for (const node of nodeArr) {
    if (node === draggedNode) continue; // locked by cursor
    node.vx *= damping;
    node.vy *= damping;
    node.x += node.vx;
    node.y += node.vy;
  }
}

// ── Render Frame ──
function render() {
  const canvas = canvasRef.value;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  stepPhysics();

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(transform.value.x, transform.value.y);
  ctx.scale(transform.value.k, transform.value.k);

  const query = searchQuery.value.trim().toLowerCase();

  // 1. Draw Links
  for (const link of links.value) {
    const isHighlighted =
      hoveredNode.value &&
      (link.source.id === hoveredNode.value.id || link.target.id === hoveredNode.value.id);

    ctx.beginPath();
    ctx.moveTo(link.source.x, link.source.y);
    ctx.lineTo(link.target.x, link.target.y);

    if (isHighlighted) {
      ctx.strokeStyle = link.reason === 'tag' ? '#a855f7' : '#38bdf8';
      ctx.lineWidth = 2.5;
    } else {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 1;
    }
    ctx.stroke();
  }

  // 2. Draw Nodes
  for (const node of nodes.value) {
    const isHovered = hoveredNode.value?.id === node.id;
    const isSelected = selectedNode.value?.id === node.id;
    const matchesSearch = query ? node.note.content.toLowerCase().includes(query) || node.tags.some(t => t.includes(query)) : true;

    ctx.save();
    ctx.globalAlpha = matchesSearch ? 1 : 0.25;

    // Glowing ring if hovered / pinned / selected
    if (isHovered || isSelected || node.note.pinned) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.radius + (isHovered ? 6 : 4), 0, Math.PI * 2);
      ctx.fillStyle = node.color + '44';
      ctx.fill();
    }

    // Node body
    ctx.beginPath();
    ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
    ctx.fillStyle = node.color;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = isHovered ? '#ffffff' : 'rgba(0, 0, 0, 0.4)';
    ctx.stroke();

    // Inner text (#ID)
    ctx.fillStyle = '#0f172a';
    ctx.font = `bold ${Math.max(10, node.radius * 0.7)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${node.id}`, node.x, node.y);

    // Label under node
    ctx.fillStyle = isHovered ? '#ffffff' : 'rgba(255, 255, 255, 0.7)';
    ctx.font = '11px sans-serif';
    const label = node.note.content.slice(0, 18) + (node.note.content.length > 18 ? '...' : '');
    ctx.fillText(label, node.x, node.y + node.radius + 12);

    ctx.restore();
  }

  ctx.restore();

  animationFrameId = requestAnimationFrame(render);
}

function resizeCanvas() {
  const canvas = canvasRef.value;
  const container = containerRef.value;
  if (!canvas || !container) return;

  canvas.width = container.clientWidth;
  canvas.height = container.clientHeight;
}

// ── Mouse / Touch Interactivity ──
function screenToWorld(sx: number, sy: number) {
  return {
    x: (sx - transform.value.x) / transform.value.k,
    y: (sy - transform.value.y) / transform.value.k,
  };
}

function findNodeAt(sx: number, sy: number): GraphNode | null {
  const { x, y } = screenToWorld(sx, sy);
  for (let i = nodes.value.length - 1; i >= 0; i--) {
    const n = nodes.value[i];
    const dx = n.x - x;
    const dy = n.y - y;
    if (dx * dx + dy * dy <= n.radius * n.radius * 1.3) {
      return n;
    }
  }
  return null;
}

function onMouseDown(e: MouseEvent) {
  const rect = canvasRef.value?.getBoundingClientRect();
  if (!rect) return;
  const sx = e.clientX - rect.left;
  const sy = e.clientY - rect.top;

  const hit = findNodeAt(sx, sy);
  if (hit) {
    isDragging = true;
    draggedNode = hit;
    dragStartX = sx;
    dragStartY = sy;
    selectedNode.value = hit;
  } else {
    isPanning = true;
    panStartX = sx - transform.value.x;
    panStartY = sy - transform.value.y;
  }
}

function onMouseMove(e: MouseEvent) {
  const rect = canvasRef.value?.getBoundingClientRect();
  if (!rect) return;
  const sx = e.clientX - rect.left;
  const sy = e.clientY - rect.top;

  if (isDragging && draggedNode) {
    const world = screenToWorld(sx, sy);
    draggedNode.x = world.x;
    draggedNode.y = world.y;
    draggedNode.vx = 0;
    draggedNode.vy = 0;
  } else if (isPanning) {
    transform.value.x = sx - panStartX;
    transform.value.y = sy - panStartY;
  } else {
    hoveredNode.value = findNodeAt(sx, sy);
  }
}

function onMouseUp() {
  isDragging = false;
  draggedNode = null;
  isPanning = false;
}

function onWheel(e: WheelEvent) {
  e.preventDefault();
  const rect = canvasRef.value?.getBoundingClientRect();
  if (!rect) return;
  const sx = e.clientX - rect.left;
  const sy = e.clientY - rect.top;

  const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
  const newK = Math.max(0.3, Math.min(3, transform.value.k * zoomFactor));

  // Zoom towards mouse pointer
  transform.value.x = sx - (sx - transform.value.x) * (newK / transform.value.k);
  transform.value.y = sy - (sy - transform.value.y) * (newK / transform.value.k);
  transform.value.k = newK;
}

function onDblClick(e: MouseEvent) {
  const rect = canvasRef.value?.getBoundingClientRect();
  if (!rect) return;
  const hit = findNodeAt(e.clientX - rect.left, e.clientY - rect.top);
  if (hit) {
    emit('edit', hit.note);
  }
}

function resetView() {
  transform.value = { x: 0, y: 0, k: 1 };
  buildGraph();
}

onMounted(() => {
  resizeCanvas();
  buildGraph();
  animationFrameId = requestAnimationFrame(render);
  window.addEventListener('resize', resizeCanvas);
});

onUnmounted(() => {
  if (animationFrameId) cancelAnimationFrame(animationFrameId);
  window.removeEventListener('resize', resizeCanvas);
});

watch(() => notesStore.notes.length, buildGraph);
</script>

<template>
  <div ref="containerRef" class="knowledge-graph-container">
    <!-- Controls Header -->
    <div class="graph-header">
      <div class="search-field">
        <span class="search-icon">🔍</span>
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Destacar nó por texto ou #tag..."
        />
      </div>

      <div class="graph-legend">
        <span class="legend-item"><span class="dot semantic"></span> Conexão Semântica</span>
        <span class="legend-item"><span class="dot tag"></span> Tag em Comum</span>
        <button class="reset-btn" @click="resetView" title="Centralizar visualização">
          🔄 Centralizar
        </button>
      </div>
    </div>

    <!-- Canvas Viewport -->
    <canvas
      ref="canvasRef"
      class="graph-canvas"
      @mousedown="onMouseDown"
      @mousemove="onMouseMove"
      @mouseup="onMouseUp"
      @mouseleave="onMouseUp"
      @wheel="onWheel"
      @dblclick="onDblClick"
    />

    <!-- Hovered Node Tooltip Preview -->
    <div v-if="hoveredNode" class="node-tooltip">
      <div class="tooltip-header">
        <strong># Memória {{ hoveredNode.id }}</strong>
        <span class="conn-count">{{ hoveredNode.connections }} conexões</span>
      </div>
      <p class="tooltip-content">{{ hoveredNode.note.content }}</p>
      <div v-if="hoveredNode.tags.length" class="tooltip-tags">
        <span v-for="t in hoveredNode.tags" :key="t" class="t-badge">#{{ t }}</span>
      </div>
      <small class="tooltip-hint">Clique duplo para editar</small>
    </div>
  </div>
</template>

<style scoped>
.knowledge-graph-container {
  position: relative;
  width: 100%;
  height: 480px;
  background: rgba(15, 23, 42, 0.5);
  border: 1px solid var(--border);
  border-radius: 14px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.graph-header {
  position: absolute;
  top: 12px;
  left: 12px;
  right: 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  z-index: 10;
  pointer-events: none;
  flex-wrap: wrap;
  gap: 10px;
}

.search-field {
  pointer-events: auto;
  display: flex;
  align-items: center;
  background: rgba(15, 23, 42, 0.85);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 4px 12px;
  backdrop-filter: blur(8px);
}

.search-field input {
  background: transparent;
  border: none;
  color: var(--text-primary);
  font-size: 0.8rem;
  outline: none;
  width: 180px;
}

.search-icon {
  font-size: 0.75rem;
  margin-right: 6px;
  opacity: 0.6;
}

.graph-legend {
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: 12px;
  background: rgba(15, 23, 42, 0.85);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 4px 12px;
  font-size: 0.75rem;
  color: var(--text-secondary);
  backdrop-filter: blur(8px);
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.dot.semantic {
  background: #38bdf8;
}

.dot.tag {
  background: #a855f7;
}

.reset-btn {
  background: rgba(255, 255, 255, 0.1);
  border: none;
  color: var(--text-primary);
  border-radius: 6px;
  padding: 2px 8px;
  font-size: 0.7rem;
  cursor: pointer;
}

.graph-canvas {
  width: 100%;
  height: 100%;
  cursor: grab;
}

.graph-canvas:active {
  cursor: grabbing;
}

.node-tooltip {
  position: absolute;
  bottom: 16px;
  left: 16px;
  max-width: 280px;
  background: rgba(15, 23, 42, 0.95);
  border: 1px solid var(--accent);
  border-radius: 12px;
  padding: 12px 14px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(10px);
  z-index: 20;
  pointer-events: none;
  animation: fadeIn 0.15s ease-out;
}

.tooltip-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
  font-size: 0.8rem;
  color: var(--accent);
}

.conn-count {
  font-size: 0.7rem;
  color: var(--text-secondary);
}

.tooltip-content {
  margin: 0 0 8px 0;
  font-size: 0.8rem;
  color: var(--text-primary);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.tooltip-tags {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  margin-bottom: 6px;
}

.t-badge {
  background: rgba(56, 189, 248, 0.15);
  color: var(--accent);
  font-size: 0.65rem;
  padding: 1px 6px;
  border-radius: 8px;
}

.tooltip-hint {
  font-size: 0.65rem;
  color: var(--text-secondary);
  opacity: 0.8;
}
</style>
