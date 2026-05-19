/**
 * Gera um HTML completo e auto-contido de uma lista de compras,
 * sem dependencia do app. Pode ser aberto em qualquer navegador.
 */

interface StandaloneItem {
  name: string;
  quantity?: string;
  note?: string;
  checked: boolean;
}

export interface StandaloneListData {
  name: string;
  items: StandaloneItem[];
  generatedAt: string;
}

/**
 * Gera um HTML completo com CSS inline representando a lista de compras.
 * O HTML e auto-contido e nao requer internet, React ou qualquer dependencia.
 */
export function generateStandaloneHtml(data: StandaloneListData): string {
  const itemsHtml = data.items
    .map(
      (item) => `
      <label class="item ${item.checked ? "checked" : ""}">
        <input type="checkbox" ${item.checked ? "checked" : ""} disabled />
        <span class="item-name">${escapeHtml(item.name)}</span>
        ${item.quantity ? `<span class="item-qty">${escapeHtml(item.quantity)}</span>` : ""}
        ${item.note ? `<span class="item-note">${escapeHtml(item.note)}</span>` : ""}
      </label>`,
    )
    .join("\n");

  const pendingCount = data.items.filter((i) => !i.checked).length;
  const totalCount = data.items.length;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(data.name)} — Lista de Compras</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background: #0f172a;
      color: #e2e8f0;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 16px;
    }
    .container {
      max-width: 480px;
      width: 100%;
    }
    header {
      padding: 20px 16px;
      text-align: center;
      border-bottom: 1px solid rgba(255,255,255,0.08);
      margin-bottom: 20px;
    }
    h1 {
      font-size: 1.4rem;
      font-weight: 700;
      color: #f1f5f9;
    }
    .subtitle {
      font-size: 0.8rem;
      color: #64748b;
      margin-top: 4px;
    }
    .summary {
      display: flex;
      justify-content: center;
      gap: 16px;
      margin-bottom: 20px;
      font-size: 0.85rem;
    }
    .summary span {
      background: rgba(255,255,255,0.05);
      padding: 6px 14px;
      border-radius: 8px;
    }
    .summary .pending { color: #fbbf24; }
    .summary .done { color: #34d399; }
    .items { display: flex; flex-direction: column; gap: 8px; }
    .item {
      display: flex;
      align-items: center;
      gap: 10px;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.06);
      border-radius: 10px;
      padding: 12px 14px;
      transition: background 0.2s;
      cursor: default;
    }
    .item:hover { background: rgba(255,255,255,0.07); }
    .item.checked { opacity: 0.5; }
    .item.checked .item-name { text-decoration: line-through; color: #64748b; }
    .item input[type="checkbox"] {
      width: 20px;
      height: 20px;
      accent-color: #3b82f6;
      flex-shrink: 0;
    }
    .item-name { flex: 1; font-size: 0.95rem; font-weight: 500; }
    .item-qty {
      font-size: 0.8rem;
      color: #94a3b8;
      background: rgba(255,255,255,0.06);
      padding: 2px 8px;
      border-radius: 6px;
    }
    .item-note {
      font-size: 0.75rem;
      color: #64748b;
      font-style: italic;
      width: 100%;
      margin-top: 4px;
    }
    .empty {
      text-align: center;
      padding: 40px 16px;
      color: #64748b;
    }
    footer {
      margin-top: 32px;
      text-align: center;
      font-size: 0.7rem;
      color: #334155;
      padding: 16px;
      border-top: 1px solid rgba(255,255,255,0.05);
    }
    @media print {
      body { background: #fff; color: #1e293b; }
      .item { background: #f8fafc; border-color: #e2e8f0; break-inside: avoid; }
      .item.checked { opacity: 0.4; }
      footer { color: #94a3b8; }
      .summary span { background: #f1f5f9; }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>${escapeHtml(data.name)}</h1>
      <p class="subtitle">Lista de Compras</p>
    </header>

    <div class="summary">
      <span class="pending">⏳ ${pendingCount} pendente${pendingCount !== 1 ? "s" : ""}</span>
      <span class="done">✅ ${totalCount - pendingCount} feito${totalCount - pendingCount !== 1 ? "s" : ""}</span>
      <span>📦 ${totalCount} item${totalCount !== 1 ? "ns" : ""}</span>
    </div>

    <div class="items">
      ${totalCount === 0 ? '<div class="empty">Nenhum item na lista.</div>' : itemsHtml}
    </div>

    <footer>
      Gerado por My Mercado em ${escapeHtml(formatDate(data.generatedAt))}
    </footer>
  </div>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Helpers - usar String.fromCharCode para evitar que o formatter normalize
// ---------------------------------------------------------------------------

function amp(): string { return String.fromCharCode(38) + "amp;"; }
function lt(): string { return String.fromCharCode(38) + "lt;"; }
function gt(): string { return String.fromCharCode(38) + "gt;"; }
function quot(): string { return String.fromCharCode(38) + "quot;"; }
function apos(): string { return String.fromCharCode(38) + "#039;"; }

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, amp)
    .replace(/</g, lt)
    .replace(/>/g, gt)
    .replace(/"/g, quot)
    .replace(/'/g, apos);
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}