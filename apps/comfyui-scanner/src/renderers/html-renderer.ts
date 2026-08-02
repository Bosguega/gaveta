/**
 * HtmlRenderer - standalone HTML document with CSS Grid, dark mode prep.
 * Implements Renderer<string>.
 */
import type { Section } from '@/cards/section';
import type { Card } from '@/cards/card';
import type { Renderer } from './renderer';

const ICON_MAP: Record<string, string> = {
    'diffusion': '🔮', 'lora': '🎨', 'vae': '🔧',
    'text-encoder': '📝', 'custom-node': '📦', 'workflow': '🧩', 'generic': '📄',
};

function renderCard(card: Card): string {
    const icon = ICON_MAP[card.icon] || '📄';
    const badges = card.badges.map(b => '<span class="badge badge-' + escapeHtml(b.color || 'gray') + '">' + escapeHtml(b.label) + '</span>').join('');
    const fields = card.fields.map(f => '<div class="field"><span class="field-label">' + escapeHtml(f.label) + '</span><span class="field-value">' + escapeHtml(f.value) + '</span></div>').join('');
    const warning = card.warning ? '<div class="warning">⚠ ' + escapeHtml(card.warning) + '</div>' : '';
    return '<div class="card"><div class="card-header"><span class="card-icon">' + icon + '</span><div><div class="card-title">' + escapeHtml(card.title) + '</div>' + (card.subtitle ? '<div class="card-subtitle">' + escapeHtml(card.subtitle) + '</div>' : '') + '</div></div><div class="card-badges">' + badges + '</div><div class="card-fields">' + fields + '</div>' + warning + '</div>';
}

function escapeHtml(value: string): string {
    return value.replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]!);
}

export const htmlRenderer: Renderer<string> = {
    render(sections: Section[]): string {
        const totalItems = sections.reduce((sum, s) => sum + s.cards.length, 0);
        const sectionsHtml = sections.map(s =>
            '<section class="cat-section"><h2 class="section-title">' + s.title + ' <span class="count">(' + s.cards.length + ')</span></h2><div class="cards-grid">' + s.cards.map(renderCard).join('') + '</div></section>'
        ).join('');
        return '<!DOCTYPE html>\n<html lang="pt-BR">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n<title>ComfyUI Scanner</title>\n<style>\n:root{--bg:#f3f4f6;--card-bg:#fff;--text:#1f2937;--border:#e5e7eb;--primary:#6366f1}\n@media(prefers-color-scheme:dark){:root{--bg:#111827;--card-bg:#1f2937;--text:#f3f4f6;--border:#374151}}\nbody{font-family:-apple-system,sans-serif;background:var(--bg);color:var(--text);margin:0;padding:20px}\n.header{text-align:center;margin-bottom:32px}\n.header h1{background:linear-gradient(135deg,#6366f1,#8b5cf6);-webkit-background-clip:text;-webkit-text-fill-color:transparent;font-size:28px}\n.cards-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(350px,1fr));gap:16px}\n.card{background:var(--card-bg);border-radius:12px;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,.1)}\n.card-header{display:flex;gap:12px;align-items:center;margin-bottom:12px}\n.card-icon{font-size:24px}\n.card-title{font-weight:600;font-size:16px}\n.card-subtitle{font-size:13px;color:#6b7280}\n.card-badges{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px}\n.badge{padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600}\n.badge-blue{background:#dbeafe;color:#1d4ed8}\n.badge-purple{background:#e9d5ff;color:#7c3aed}\n.badge-green{background:#d1fae5;color:#059669}\n.badge-orange{background:#fed7aa;color:#c2410c}\n.badge-gray{background:#e5e7eb;color:#4b5563}\n.badge-teal{background:#ccfbf1;color:#0f766e}\n.field{display:flex;justify-content:space-between;padding:4px 0;font-size:13px;border-bottom:1px solid var(--border)}\n.field-label{color:#6b7280;flex-shrink:0}\n.field-value{font-weight:500;word-break:break-all;text-align:right;margin-left:12px}\n.warning{margin-top:8px;padding:8px;background:#fef3c7;border-radius:6px;color:#92400e;font-size:12px}\n.section-title{margin:32px 0 16px;font-size:20px}\n.count{color:#6b7280;font-size:14px}\n</style>\n</head>\n<body>\n<div class="header"><h1>ComfyUI Scanner</h1><p>' + totalItems + ' itens encontrados</p></div>\n' + sectionsHtml + '\n</body>\n</html>';
    },
};
