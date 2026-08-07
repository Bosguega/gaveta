<script setup lang="ts">
import { computed, ref } from 'vue';
import { isIndexingWorkflows, refreshWorkflowIndex, workflowIndex, workflowIndexError } from '@/composables/useComfyUIScan';

const expanded = ref<Set<string>>(new Set());

const modelUsage = computed(() => Object.entries(workflowIndex.value?.model_usage ?? {})
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 8));
const missingCount = computed(() => workflowIndex.value?.workflows.reduce((total, workflow) => total + workflow.dependencies.filter(item => item.status === 'missing').length, 0) ?? 0);

function toggle(path: string) {
    expanded.value.has(path) ? expanded.value.delete(path) : expanded.value.add(path);
}

function searchCivitai(query: string) {
    const url = `https://civitai.com/search/models?query=${encodeURIComponent(query)}`;
    window.open(url, '_blank');
}
</script>

<template>
    <section class="dependency-index">
        <header class="index-header">
            <div>
                <span class="eyebrow">WORKFLOW DEPENDENCY INDEX</span>
                <h2>Dependências dos workflows</h2>
                <p>Relações entre workflows salvos, modelos locais e custom nodes.</p>
            </div>
            <button class="refresh-button" :disabled="isIndexingWorkflows" @click="refreshWorkflowIndex">
                {{ isIndexingWorkflows ? 'Indexando...' : 'Atualizar índice' }}
            </button>
        </header>

        <p v-if="workflowIndexError" class="index-error">{{ workflowIndexError }}</p>
        <p v-else-if="isIndexingWorkflows" class="index-loading">Lendo workflows e cruzando dependências locais…</p>

        <template v-else-if="workflowIndex">
            <div class="index-stats">
                <div class="index-stat"><strong>{{ workflowIndex.workflows.length }}</strong><span>workflows catalogados</span></div>
                <div class="index-stat"><strong>{{ workflowIndex.unused_models.length }}</strong><span>modelos não referenciados</span></div>
                <div class="index-stat" :class="{ warning: missingCount > 0 }"><strong>{{ missingCount }}</strong><span>dependências ausentes</span></div>
            </div>

            <div class="index-grid">
                <article class="index-card">
                    <h3>Modelos mais usados</h3>
                    <ol v-if="modelUsage.length" class="usage-list">
                        <li v-for="[model, uses] in modelUsage" :key="model"><span>{{ model }}</span><b>{{ uses }} workflow{{ uses === 1 ? '' : 's' }}</b></li>
                    </ol>
                    <p v-else class="empty-state">Nenhum modelo foi identificado nos workflows JSON.</p>
                </article>
                <article class="index-card">
                    <h3>Modelos não referenciados</h3>
                    <p v-if="workflowIndex.unused_models.length" class="unused-list">{{ workflowIndex.unused_models.slice(0, 10).join(' · ') }}<span v-if="workflowIndex.unused_models.length > 10"> e mais {{ workflowIndex.unused_models.length - 10 }}</span></p>
                    <p v-else class="empty-state">Todos os modelos catalogados aparecem em pelo menos um workflow.</p>
                </article>
            </div>

            <div class="workflow-list">
                <h3>Workflows catalogados</h3>
                <p v-if="workflowIndex.workflows.length === 0" class="empty-state workflow-empty">
                    Nenhum workflow JSON encontrado na instalação. Salve workflows em formato API no ComfyUI para que apareçam aqui.
                </p>
                <article v-for="workflow in workflowIndex.workflows" :key="workflow.path" class="workflow-row">
                    <button class="workflow-title" @click="toggle(workflow.path)">
                        <span>{{ expanded.has(workflow.path) ? '⌄' : '›' }}</span>
                        <strong>{{ workflow.name }}</strong>
                        <small>{{ workflow.dependencies.length }} modelos · {{ workflow.node_types.length }} nós</small>
                    </button>
                    <div v-if="expanded.has(workflow.path)" class="workflow-detail">
                        <div class="dep-section">
                            <b>Modelos:</b>
                            <div v-if="workflow.dependencies.length" class="dep-tags-list">
                                <span
                                    v-for="dep in workflow.dependencies"
                                    :key="dep.name"
                                    class="dep-tag"
                                    :class="{ 'dep-missing': dep.status === 'missing' }"
                                >
                                    {{ dep.name }}
                                    <button
                                        v-if="dep.status === 'missing'"
                                        class="civitai-search-btn"
                                        @click.stop="searchCivitai(dep.name)"
                                        title="Buscar modelo no Civitai"
                                    >
                                        🔍 Civitai
                                    </button>
                                </span>
                            </div>
                            <em v-else>Nenhum modelo local identificado</em>
                        </div>
                        <p><b>Custom nodes detectados:</b> <span v-if="workflow.custom_nodes.length">{{ workflow.custom_nodes.join(' · ') }}</span><em v-else>Nenhum fornecedor de custom node identificado</em></p>
                        <p class="node-types"><b>Tipos de nó:</b> {{ workflow.node_types.join(' · ') }}</p>
                    </div>
                </article>
            </div>
        </template>
    </section>
</template>

<style scoped>
.dependency-index { margin-top: 28px; padding: 24px; border: 1px solid rgba(148,163,184,.22); border-radius: 20px; background: rgba(255,255,255,.86); box-shadow: 0 18px 48px rgba(15,23,42,.07); }
.index-header { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; margin-bottom:22px; }.eyebrow { color:#6d28d9; font-size:11px; font-weight:800; letter-spacing:.1em; }.index-header h2 { margin:4px 0; color:#18233a; font-size:22px; }.index-header p { margin:0; color:#64748b; }.refresh-button { padding:10px 14px; border:0; border-radius:10px; background:#312e81; color:#fff; font-weight:700; cursor:pointer; }.refresh-button:disabled { opacity:.65; cursor:wait; }.index-stats { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; }.index-stat { padding:16px; border:1px solid #e2e8f0; border-radius:14px; background:#f8fafc; }.index-stat strong { display:block; color:#312e81; font-size:24px; }.index-stat span { color:#64748b; font-size:13px; }.index-stat.warning strong { color:#c2410c; }.index-grid { display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-top:14px; }.index-card { padding:16px; border:1px solid #e2e8f0; border-radius:14px; }.index-card h3, .workflow-list h3 { margin:0 0 10px; color:#334155; font-size:15px; }.usage-list { margin:0; padding-left:20px; }.usage-list li { display:flex; justify-content:space-between; gap:12px; padding:5px 0; color:#475569; font-size:13px; }.usage-list span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }.usage-list b { color:#7c3aed; white-space:nowrap; }.unused-list, .empty-state { margin:0; color:#64748b; font-size:13px; line-height:1.65; }.workflow-list { margin-top:20px; }.workflow-row { border-top:1px solid #edf0f5; }.workflow-title { display:flex; align-items:center; width:100%; gap:10px; padding:13px 2px; border:0; background:none; color:#334155; cursor:pointer; text-align:left; }.workflow-title span { color:#7c3aed; font-size:22px; line-height:14px; }.workflow-title small { margin-left:auto; color:#94a3b8; }.workflow-detail { padding:0 12px 14px 30px; color:#64748b; font-size:13px; }.workflow-detail p { margin:7px 0; }.workflow-detail b { color:#475569; }.workflow-detail em { color:#94a3b8; }.node-types { overflow-wrap:anywhere; }
.dep-section { margin: 8px 0; }
.dep-tags-list { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
.dep-tag { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 8px; background: #f1f5f9; border: 1px solid #e2e8f0; color: #334155; font-size: 12px; font-weight: 500; }
.dep-tag.dep-missing { background: #fef2f2; border-color: #fecaca; color: #991b1b; }
.civitai-search-btn { padding: 2px 7px; border-radius: 6px; border: none; background: #3b82f6; color: white; font-size: 10px; font-weight: 700; cursor: pointer; transition: background .2s; }
.civitai-search-btn:hover { background: #2563eb; }
.index-error { padding:12px; border-radius:10px; background:#fef2f2; color:#b91c1c; }.index-loading { color:#64748b; } @media (max-width:700px) { .dependency-index { padding:16px; }.index-header { flex-direction:column; }.index-stats, .index-grid { grid-template-columns:1fr; }.refresh-button { width:100%; }.workflow-title { align-items:flex-start; }.workflow-title small { margin-left:0; } }
</style>
