const ALLOWED_HOSTS = ['www.nfce.fazenda.sp.gov.br', 'nfce.fazenda.sp.gov.br'];
const ALLOWED_PATHS = [
  /^\/qrcode$/i,
  /^\/NFCeConsultaPublica\/Paginas\/ConsultaQRCode\.aspx$/i,
];
const pending = new Map();

function validateUrl(raw) {
  let u;
  try { u = new URL(raw); } catch (e) { return { ok: false, reason: 'URL inválida' }; }
  if (u.protocol !== 'https:') return { ok: false, reason: 'URL não usa HTTPS' };
  if (!ALLOWED_HOSTS.includes(u.hostname)) return { ok: false, reason: 'Domínio não permitido' };
  if (!ALLOWED_PATHS.some((re) => re.test(u.pathname))) return { ok: false, reason: 'Caminho não é de consulta NFC-e' };
  if (!u.searchParams.has('p')) return { ok: false, reason: 'Parâmetro p ausente' };
  return { ok: true, url: u.href };
}

function cleanup(requestId) {
  const p = pending.get(requestId);
  if (!p) return false;
  if (p.captureTimer) clearTimeout(p.captureTimer);
  if (p.ackTimer) clearTimeout(p.ackTimer);
  if (p.nfceTabId) { try { chrome.tabs.remove(p.nfceTabId); } catch (e) {} }
  pending.delete(requestId);
  return true;
}

function finalize(requestId, result) {
  const p = pending.get(requestId);
  if (!p || p.finished) return;
  p.finished = true;
  if (p.captureTimer) clearTimeout(p.captureTimer);
  if (p.ackTimer) clearTimeout(p.ackTimer);
  try { chrome.tabs.sendMessage(p.hostTabId, { type: 'import-result', requestId, ...result }); } catch (e) {}
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === 'import-nfce') {
    const v = validateUrl(msg.url);
    if (!v.ok) { sendResponse({ ok: false, error: v.reason }); return true; }
    const requestId = msg.requestId;
    // Cria primeiro uma aba vazia para registrar a solicitação antes de o
    // content script da SEFAZ poder executar após o redirecionamento.
    chrome.tabs.create({ url: 'about:blank', active: false }, (tab) => {
      if (chrome.runtime.lastError || !tab?.id) {
        sendResponse({ ok: false, error: chrome.runtime.lastError?.message || 'Não foi possível abrir a consulta da SEFAZ' });
        return;
      }
      const nfceTabId = tab.id;
      const captureTimer = setTimeout(() => {
        if (!pending.has(requestId) || pending.get(requestId).finished) return;
        finalize(requestId, { ok: false, error: 'Tempo esgotado aguardando a página da SEFAZ', step: 'timeout' });
        cleanup(requestId);
      }, 20000);
      pending.set(requestId, { requestId, hostTabId: sender.tab.id, nfceTabId, captureTimer, ackTimer: null, finished: false });
      chrome.tabs.update(nfceTabId, { url: v.url }, () => {
        if (chrome.runtime.lastError) {
          finalize(requestId, { ok: false, error: 'Não foi possível navegar até a SEFAZ: ' + chrome.runtime.lastError.message, step: 'navigation' });
          cleanup(requestId);
        }
      });
      sendResponse({ ok: true, tabId: nfceTabId });
    });
    return true;
  }

  if (msg && msg.type === 'nfce-captured') {
    let foundKey = null;
    for (const [k, v] of pending.entries()) {
      if (!v.finished && v.nfceTabId === sender.tab.id) { foundKey = k; break; }
    }
    if (!foundKey) { sendResponse({ ok: false, error: 'sem solicitação pendente' }); return true; }
    const text = msg.text || '';
    const valid = text.length >= 200 && /NFC-?e|Nota Fiscal/i.test(text);
    if (!valid) {
      finalize(foundKey, { ok: false, error: 'A página da SEFAZ abriu, mas não apresentou o conteúdo esperado da NFC-e', step: 'content', charCount: text.length });
      cleanup(foundKey);
      sendResponse({ ok: true });
      return true;
    }
    const p = pending.get(foundKey);
    if (p.captureTimer) clearTimeout(p.captureTimer);
    try { chrome.tabs.sendMessage(p.hostTabId, { type: 'import-result', requestId: foundKey, ok: true, text, charCount: text.length, step: 'delivered-awaiting-ack' }); } catch (e) {}
    p.ackTimer = setTimeout(() => {
      if (pending.has(foundKey) && !pending.get(foundKey).finished) {
        finalize(foundKey, { ok: false, error: 'Tempo esgotado aguardando confirmação de entrega ao My Mercado', step: 'delivery-timeout' });
        cleanup(foundKey);
      }
    }, 5000);
    pending.set(foundKey, p);
    sendResponse({ ok: true });
    return true;
  }

  if (msg && msg.type === 'delivery-ack') {
    const p = pending.get(msg.requestId);
    if (!p || p.finished) { sendResponse({ ok: false, error: 'solicitação já finalizada' }); return true; }
    p.finished = true;
    if (p.ackTimer) clearTimeout(p.ackTimer);
    try { chrome.tabs.remove(p.nfceTabId); } catch (e) {}
    pending.delete(msg.requestId);
    sendResponse({ ok: true });
    return true;
  }

  if (msg && msg.type === 'ping') {
    sendResponse({ ok: true, active: true });
    return true;
  }
  return false;
});

chrome.tabs.onRemoved.addListener((tabId) => {
  for (const [k, v] of pending.entries()) {
    if (!v.finished && v.nfceTabId === tabId) {
      finalize(k, { ok: false, error: 'Aba da consulta fechada inesperadamente', step: 'tab-closed' });
      cleanup(k);
    }
  }
});
