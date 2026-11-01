const ALLOWED_HOSTS = ['www.nfce.fazenda.sp.gov.br', 'nfce.fazenda.sp.gov.br'];
const ALLOWED_PATHS = [/^\/NFCeConsultaPublica\/Paginas\/ConsultaQRCode\.aspx$/i];
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
  // tab removal only after delivery ack; handled in ack branch
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === 'import-nfce') {
    const v = validateUrl(msg.url);
    if (!v.ok) { sendResponse({ ok: false, error: v.reason }); return true; }
    const requestId = msg.requestId;
    chrome.tabs.create({ url: v.url, active: false }, (tab) => {
      const nfceTabId = tab.id;
      const captureTimer = setTimeout(() => {
        if (!pending.has(requestId) || pending.get(requestId).finished) return;
        finalize(requestId, { ok: false, error: 'Timeout na captura', step: 'timeout' });
        cleanup(requestId);
      }, 20000);
      pending.set(requestId, { requestId, hostTabId: sender.tab.id, nfceTabId, captureTimer, ackTimer: null, finished: false });
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
      finalize(foundKey, { ok: false, error: 'Conteúdo insuficiente ou página inválida', step: 'content', charCount: text.length });
      cleanup(foundKey);
      sendResponse({ ok: true });
      return true;
    }
    const p = pending.get(foundKey);
    if (p.captureTimer) clearTimeout(p.captureTimer);
    // deliver and await ack
    try { chrome.tabs.sendMessage(p.hostTabId, { type: 'import-result', requestId: foundKey, ok: true, text: text, charCount: text.length, step: 'delivered-awaiting-ack' }); } catch (e) {}
    p.ackTimer = setTimeout(() => {
      if (pending.has(foundKey) && !pending.get(foundKey).finished) {
        finalize(foundKey, { ok: false, error: 'Timeout na confirmação de entrega', step: 'delivery-timeout' });
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
      finalize(k, { ok: false, error: 'Aba fechada inesperadamente', step: 'tab-closed' });
      cleanup(k);
    }
  }
});